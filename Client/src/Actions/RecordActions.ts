import { uniqueId } from 'lodash';

import {
  BasketStatusErrorAction,
  BasketStatusLoadingAction,
  BasketStatusReceivedAction,
  FavoritesStatusErrorAction,
  FavoritesStatusLoadingAction,
  FavoritesStatusReceivedAction,
  loadBasketStatus,
  loadFavoritesStatus,
} from 'wdk-client/Actions/UserActions';
import { ActionThunk, EmptyAction, emptyAction } from 'wdk-client/Utils/ActionCreatorUtils';
import { CategoryTreeNode } from 'wdk-client/Utils/CategoryUtils';
import { getTree } from 'wdk-client/Utils/OntologyUtils';
import { RecordClass, RecordInstance } from 'wdk-client/Utils/WdkModel';
import WdkService, { ServiceError } from 'wdk-client/Utils/WdkService';

import { isLeafFor, isNotInternalNode } from 'wdk-client/Views/Records/RecordUtils';

export type Action =
  | RecordReceivedAction
  | RecordUpdatedAction
  | RecordLoadingAction
  | RecordErrorAction
  | SectionVisibilityAction
  | AllFieldVisibilityAction
  | NavigationVisibilityAction
  | CategoryExpansionAction
  | NavigationQueryAction


//==============================================================================

export const RECORD_RECEIVED = 'record-view/record-received';

export type RecordReceivedAction = {
  type: typeof RECORD_RECEIVED;
  id: string,
  payload: {
    record: RecordInstance,
    recordClass: RecordClass,
    categoryTree: CategoryTreeNode
  },
}

export function recordReceived(id: string, payload: RecordReceivedAction['payload']): RecordReceivedAction {
  return {
    type: RECORD_RECEIVED,
    id,
    payload
  };
}

//==============================================================================

export const RECORD_UPDATE = 'record-view/record-update';

export type RecordUpdatedAction = {
  type: typeof RECORD_UPDATE,
  id: string,
  payload: {
    record: RecordInstance
  },
}

export function recordUpdate(id: string, record: RecordInstance): RecordUpdatedAction {
  return {
    type: RECORD_UPDATE,
    id,
    payload: { 
      record
    }
  }
}

//==============================================================================

export const RECORD_LOADING = 'record-view/record-loading';

export type RecordLoadingAction = {
  type: typeof RECORD_LOADING,
  id: string,
  payload: {
    recordClassName: string,
    primaryKeyValues: string[]
  },
}

export function recordLoading(id: string, payload: RecordLoadingAction['payload']): RecordLoadingAction {
  return {
    type: RECORD_LOADING,
    id,
    payload
  }
}

//==============================================================================

export const RECORD_ERROR = 'record-view/record-error';

export type RecordErrorAction = {
  type: typeof RECORD_ERROR;
  id: string
  payload: { error: ServiceError },
}

export function recordError(id: string, error: ServiceError): RecordErrorAction {
  return {
    type: RECORD_ERROR,
    id,
    payload: {
      error
    }
  };
}

//==============================================================================

export const SECTION_VISIBILITY = 'record-view/section-visibility-changed';

export type SectionVisibilityAction = {
  type: typeof SECTION_VISIBILITY;
  payload: {
    name: string,
    isVisible: boolean
  }
}

/** Update a section's collapsed status */
export function updateSectionVisibility(sectionName: string, isVisible: boolean): SectionVisibilityAction {
  return {
    type: SECTION_VISIBILITY,
    payload: { name: sectionName, isVisible }
  };
}

//==============================================================================

export const ALL_FIELD_VISIBILITY = 'record-view/all-field-visibility-changed';

export type AllFieldVisibilityAction = {
  type: typeof ALL_FIELD_VISIBILITY,
  payload: {
    isVisible: boolean
  }
}

/** Change the visibility for all record fields (attributes and tables) */
export function updateAllFieldVisibility(isVisible: boolean): AllFieldVisibilityAction {
  return {
    type: ALL_FIELD_VISIBILITY,
    payload: { isVisible }
  }
}

//==============================================================================

export const NAVIGATION_VISIBILITY = 'record-view/navigation-visibility-changed';

export type NavigationVisibilityAction = {
  type: typeof NAVIGATION_VISIBILITY,
  payload: {
    isVisible: boolean
  }
}

/** Change the visibility of the navigation panel */
export function updateNavigationVisibility(isVisible: boolean): NavigationVisibilityAction {
  return {
    type: NAVIGATION_VISIBILITY,
    payload: { isVisible }
  }
}

//==============================================================================

export const CATEGORY_EXPANSION = 'record-view/navigation-category-expansion-changed';

export type CategoryExpansionAction = {
  type: typeof CATEGORY_EXPANSION,
  payload: {
    expandedCategories: string[]
  }
}

/** Change the visibility of subcategories in the navigation section */
export function updateNavigationCategoryExpansion(expandedCategories: string[]): CategoryExpansionAction {
  return {
    type: CATEGORY_EXPANSION,
    payload: { expandedCategories }
  }
}

//==============================================================================

export const NAVIGATION_QUERY = 'record-view/navigation-query-changed';

export type NavigationQueryAction = {
  type: typeof NAVIGATION_QUERY,
  payload: {
    query: string
  }
}

/** Update navigation section search term */
export function updateNavigationQuery(query: string): NavigationQueryAction {
  return {
    type: NAVIGATION_QUERY,
    payload: { query }
  };
}

//==============================================================================


// thunks
// ------

type BasketAction = BasketStatusLoadingAction | BasketStatusErrorAction | BasketStatusReceivedAction;
type FavoriteAction = FavoritesStatusLoadingAction | FavoritesStatusReceivedAction | FavoritesStatusErrorAction;

type LoadRecordAction = RecordLoadingAction
  | RecordErrorAction
  | RecordReceivedAction
  | RecordUpdatedAction

type UserAction = BasketAction | FavoriteAction

export interface RecordRequestOptions {
  attributes: string[];
  tables: string[];
}

interface RequestRequestOptionsGetter {
  (recordClass: RecordClass, categoryTree: CategoryTreeNode): RecordRequestOptions[]
}


/** Fetch page data from services */
export function loadRecordData(
  recordClass: string,
  primaryKeyValues: string[],
  getRecordRequestOptions: RequestRequestOptionsGetter
): ActionThunk<LoadRecordAction | UserAction | EmptyAction> {
  return function run({ wdkService }) {
    return setActiveRecord(recordClass, primaryKeyValues, getRecordRequestOptions);
  };
}

/**
 * Fetches the new record from the service and dispatches related
 * actions so that the store can update.
 *
 * @param {string} recordClassName
 * @param {Array<string>} primaryKeyValues
 */
function setActiveRecord(
  recordClassName: string,
  primaryKeyValues: string[],
  getRecordRequestOptions: RequestRequestOptionsGetter
): ActionThunk<LoadRecordAction|UserAction|EmptyAction> {
  return ({ wdkService }) => {
    const id = uniqueId('recordViewId');

    return [
      recordLoading(id, { recordClassName, primaryKeyValues }),
      // Fetch the record base and tables in parallel.
      Promise.all([
        wdkService.findRecordClass(r => r.urlSegment === recordClassName),
        getPrimaryKey(wdkService, recordClassName, primaryKeyValues),
        getCategoryTree(wdkService, recordClassName)
      ]).then(
        ([recordClass, primaryKey, fullCategoryTree]) => {
          const [ initialOptions, ...additionalOptions ] =
            getRecordRequestOptions(recordClass, fullCategoryTree);
          const categoryTree = getTree({ name: '__', tree: fullCategoryTree }, isNotInternalNode);
          const initialAction$ = wdkService.getRecord(recordClass.name, primaryKey, initialOptions).then(
            record => recordReceived(id, {
              record,
              recordClass,
              categoryTree
            })
          );
          const additionalActions = additionalOptions.map(options =>
            wdkService.getRecord(recordClass.name, primaryKey, options).then(
              record => recordUpdate(id, record),
              error => recordError(id, error)
            )
          );

          return initialAction$.then(
            action => [
              action,
              additionalActions,
              recordClass.useBasket ? loadBasketStatus(action.payload.record) : emptyAction,
              loadFavoritesStatus(action.payload.record)
            ],
            error => recordError(id, error)
          );
        },
        error => recordError(id, error)
      )
    ];
  }
}

// helpers
// -------

/**
 * Get the base record request payload object
 * @param wdkService
 * @param recordClassUrlSegment
 * @param primaryKeyValues
 * @returns Promise<PrimaryKey>
 */
function getPrimaryKey(wdkService: WdkService, recordClassUrlSegment: string, primaryKeyValues: string[]) {
  return wdkService.findRecordClass(r => r.urlSegment === recordClassUrlSegment)
    .then(recordClass => {
      if (recordClass == null)
        throw new Error("Could not find a record class identified by `" + recordClassUrlSegment + "`.");

      return recordClass.primaryKeyColumnRefs
        .map((ref, index) => ({ name: ref, value: primaryKeyValues[index] }));
    })
}

/** Get the category tree for the given record class */
function getCategoryTree(wdkService: WdkService, recordClassUrlSegment: string) {
  return Promise.all([
    wdkService.getOntology(),
    wdkService.findRecordClass(r => r.urlSegment === recordClassUrlSegment)
  ]).then(([ontology, recordClass]) => {
    return getTree(ontology, isLeafFor(recordClass.name));
  });
}