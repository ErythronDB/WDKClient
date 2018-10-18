import { max, memoize, min, padStart, sortBy } from 'lodash';

import { Seq } from '../../Utils/IterableUtils';

import {
  Field,
  FieldTreeNode,
  Filter,
  FilterField,
  MultiField,
  MultiFilter,
  RangeField,
  ValueCounts
} from './Types';
import { preorderSeq, pruneDescendantNodes, postorderSeq, mapStructure } from '../../Utils/TreeUtils';

/**
 * Determine if a field should use a range filter display
 *
 * @param {Field} field
 */
export function isRange(field: Field): field is RangeField {
  return field.isRange === true;
}

export function isMulti(field: Field): field is MultiField {
  return field.type === 'multiFilter';
}

export function isFilterField(field: Field): field is FilterField {
  return field.type != null;
}

/**
 * Determine if a filter should be created, or if the values represent the default state.
 */
export function shouldAddFilter(filter: Filter, valueCounts: ValueCounts, selectByDefault: boolean) {
  if (filter.type === 'multiFilter') {
    return filter.value.filters && filter.value.filters.length > 0;
  }
  if (selectByDefault == false) {
    if (filter.isRange) {
      return (
        filter.value != null &&
        ( filter.value.min != null ||
          filter.value.max !== null )
      );
    }
    return filter.value == null ? true
      : filter.value.length == 0 ? false
      : true;
  }

  // user doesn't want unknowns
  if (!filter.includeUnknown) return true;

  // user wants everything except unknowns
  if (filter.value == null) return !filter.includeUnknown;

  if (filter.isRange) {
    const values = valueCounts
      .filter(entry => entry.value != null)
      .map(entry => filter.type === 'number' ? Number(entry.value) : entry.value);

    // these type assertions are required since Array.prototype.filter does not narrow types.
    const summaryMin = min(values) as string | number;
    const summaryMax = max(values) as string | number;
    return (
      (filter.value.min == null && filter.value.max == null) ||
      (filter.value.min != null && filter.value.min > summaryMin) ||
      (filter.value.max != null && filter.value.max < summaryMax)
    );
  }

  return filter.value.length !== valueCounts.filter(item => item.value != null).length;
}

const dateStringRe = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Returns an strftime style format string.
 * @param {string} dateString
 */
export function getFormatFromDateString(dateString: string) {
  var matches = dateString.match(dateStringRe);
  if (matches == null) {
    throw new Error(`Expected a date string using the ISO 8601 format, but got "${dateString}".`);
  }
  var [ , , m, d ] = matches;
  return  d !== undefined ? '%Y-%m-%d'
    : m !== undefined ? '%Y-%m'
    : '%Y';
}

/**
 * Returns a formatted date.
 *
 * @param {string} format strftime style format string
 * @param {Date} date
 */
export function formatDate(format: string, date: string | Date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return format
  .replace(/%Y/, String(date.getFullYear()))
  .replace(/%m/, padStart(String(date.getMonth() + 1), 2, '0'))
  .replace(/%d/, padStart(String(date.getDate()), 2, '0'));
}

export function getFilterFieldsFromOntology(ontologyEntries: Iterable<Field>): FilterField[] {
  return preorderSeq(getTree(ontologyEntries))
    .map(node => node.field)
    .filter(isFilterField)
    .toArray();
}

type ParentTerm = string | undefined;

const makeOntologyNode = (ontologyEntriesByParent: Map<ParentTerm, Field[]>) =>(field: Field): FieldTreeNode =>  {
  const childFields = ontologyEntriesByParent.get(field.term) || [];
  const children = childFields.map(makeOntologyNode(ontologyEntriesByParent));
  return { field, children };
}

const GENERATED_ROOT: Field = {
  term: '@@root@@',
  display: '@@root@@'
}

export function getTree(ontologyEntries: Iterable<Field>): FieldTreeNode {
  const entriesByParentTerm = mapBy(ontologyEntries, term => term.parent);
  const rootFields = entriesByParentTerm.get(undefined) || [];
  const rootChildren = rootFields.map(makeOntologyNode(entriesByParentTerm));

  // Return single root child, but only if it has children. Otherwise, we need
  // to place the single root beneath a generated root (below).
  return rootChildren.length == 1 && rootChildren[0].children.length > 0
    ? rootChildren[0]
    : { field: GENERATED_ROOT, children: rootChildren };
}

export function removeIntermediateNodesWithSingleChild(node: FieldTreeNode): FieldTreeNode {
  // We want to keep the subtree of any filter field (e.g., multifilter)
  if (isFilterField(node.field)) return node;
  if (node.children.length === 1) return removeIntermediateNodesWithSingleChild(node.children[0]);
  const children = node.children.map(removeIntermediateNodesWithSingleChild);
  return { ...node, children }
}

export function sortLeavesBeforeBranches(root: FieldTreeNode): FieldTreeNode {
  return mapStructure(
    sortNodeChildren,
    node => node.children,
    root
  );
}

function sortNodeChildren(node: FieldTreeNode, mappedChildren: FieldTreeNode[]): FieldTreeNode {
  return {
    ...node,
    children: sortBy(mappedChildren, entry => isFilterField(entry.field) ? -1 : 1)
  }
}

function mapBy<T, S>(iter: Iterable<T>, keyAccessor: (item: T) => S) {
  return Seq.from(iter)
    .reduce(function(map: Map<S, T[]>, item: T) {
      const key = keyAccessor(item);
      const itemArray = map.get(key) || [];
      itemArray.push(item);
      map.set(key, itemArray);
      return map;
    }, new Map<S, T[]>());
}

/**
 * Create an array of ancestor nodes for a given node predicate.
 */
export function findAncestorFields<T>(tree: FieldTreeNode, term: string): Seq<Field> {
  return postorderSeq(tree)
    .reduce((ancestors: Seq<Field>, node: FieldTreeNode) =>
      node.field.term === term ? Seq.of(node.field)
      : !ancestors.isEmpty() && node.field.term === ancestors.first().parent ? Seq.of(node.field, ...ancestors)
      : ancestors,
      Seq.empty())
}


// Formatting and display

/**
 * Creates a display string describing a filter.
 *
 * @param {Field} field
 * @param {any} value
 * @param {boolean} includeUnknown
 */
export function getFilterValueDisplay(filter: Filter): string {
  if (filter.type === 'multiFilter') {
    return filter.value.filters.map(getFilterValueDisplay)
      .join(filter.value.operation === 'union' ? ' OR ' : ' AND ')
  }
  if (filter.isRange) {
    let { value, includeUnknown } = filter;
    if (value != null && value.min == null && value.max == null && includeUnknown == false) {
      return 'No value selected';
    }

    const displayValue = value == null ? 'has a value'
                       : value.min == null && value!.max == null ? ''
                       : value.min == null ? `less than ${value.max}`
                       : value.max == null ? `greater than ${value.min}`
                       : `from ${value!.min} to ${value.max}`;
    return displayValue +
      (includeUnknown ? ( displayValue ? ', or is unspecified' : 'unspecified') : '');
  }

  else {
    let { value, includeUnknown } = filter;
    if (value != null && value.length === 0 && includeUnknown === false) {
      return 'No value selected'
    }
    return (value == null ? 'has a value' : value.join(', ')) +
      (includeUnknown ? (value && value.length === 0 ? 'unspecified' : ', or is unspecified') : '');
  }
}

export function getOperationDisplay(operation: MultiFilter['value']['operation']) {
  switch(operation) {
    case 'union': return 'any';
    case 'intersect': return 'all';
  }
}
