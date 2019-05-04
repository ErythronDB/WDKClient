import { ServiceBaseClass } from 'wdk-client/Service/ServiceBase';
import {keyBy} from 'lodash';
import { Ontology } from 'wdk-client/Utils/OntologyUtils';
import { CategoryTreeNode, pruneUnknownPaths, resolveWdkReferences, sortOntology } from 'wdk-client/Utils/CategoryUtils';

// Legacy, for backward compatibility of client code with older service API
export interface AnswerFormatting {
    format: string
    formatConfig?: object
} 

export default (base: ServiceBaseClass) => class StrategyListsService extends base {

    getOntology(name = '__wdk_categories__') {
        let recordClasses$ = this.getRecordClasses().then(rs => keyBy(rs, 'fullName'));
        let questions$ = this.getQuestions().then(qs => keyBy(qs, 'fullName'));
        let ontology$ = this._getFromCache('ontologies/' + name, () => {
          let rawOntology$ = this._fetchJson<Ontology<CategoryTreeNode>>('get', `/ontologies/${name}`);
          return Promise.all([ recordClasses$, questions$, rawOntology$ ])
          .then(([ recordClasses, questions, rawOntology ]) => {
            return sortOntology(recordClasses, questions,
              pruneUnknownPaths(recordClasses, questions, rawOntology));
          })
        });
        return Promise.all([ recordClasses$, questions$, ontology$ ])
          .then(([ recordClasses, questions, ontology ]) => {
            return resolveWdkReferences(recordClasses, questions, ontology);
          });
      }
    
}