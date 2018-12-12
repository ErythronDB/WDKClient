import {
  ErrorAction,
  InitializeAction,
  LoadingAction,
  SelectReporterAction,
  UiUpdateAction,
  UpdateAction
} from './DownloadFormActionCreators';
import WdkServiceJsonReporterForm from './WdkServiceJsonReporterForm';
import {UserPreferences, Step} from "../../Utils/WdkUser";
import {RecordClass, Question, Reporter} from "../../Utils/WdkModel";
import { ServiceError } from "../../Utils/WdkService";
import { CategoryOntology } from '../../Utils/CategoryUtils';

export type State = {
  preferences: UserPreferences | null,
  ontology: CategoryOntology | null,
  step: Step | null,
  question: Question | null,
  recordClass: RecordClass | null,
  scope: string | null,
  availableReporters: Reporter[],
  isLoading: boolean | null,
  selectedReporter: string | null,
  formState: any,
  formUiState: any,
  error?: ServiceError
}

type Action = ErrorAction
            | InitializeAction
            | LoadingAction
            | SelectReporterAction
            | UiUpdateAction
            | UpdateAction;


type GetSelectedReporter = (selectedReporterName: string|null, recordClassName: string) => SelectedReporter;

export type SelectedReporter = {
  getInitialState(state: State): any
}

const initialState: State = {
  // 'static' data that should not change for the life of the page
  preferences: null,
  ontology: null,
  step: null,
  question: null,
  recordClass: null,
  scope: null,
  availableReporters: [],

  // 'dynamic' data that is updated with user actions
  isLoading: false,
  selectedReporter: null,
  formState: null,
  formUiState: null
}

const getDefaultReporter: GetSelectedReporter = () => WdkServiceJsonReporterForm;

export const makeReducer = (getSelectedReporter: GetSelectedReporter = getDefaultReporter) => (state: State = initialState, action: Action): State => {
  switch(action.type) {

    case 'downloadForm/loading':
      return setFormLoading(state, true);

    case 'downloadForm/initialize':
      return initialize(getSelectedReporter, state, action.payload);

    case 'downloadForm/selectReporter':
      return updateReporter(getSelectedReporter, state, action.payload.selectedReporter);

    case 'downloadForm/formUpdate':
      return updateFormState(state, action.payload.formState);

    case 'downloadForm/formUiUpdate':
      return updateFormUiState(state, action.payload.formUiState);

    case 'downloadForm/error':
      return setError(state, action.payload.error);

    default:
      return state;
  }
}

export const reduce = makeReducer();


function setFormLoading(state: State, isLoading: boolean) {
  return Object.assign({}, state, { isLoading });
}

function setError(state: State, error: Error) {
  return Object.assign({}, state, { error });
}

function initialize(
  getSelectedReporter: GetSelectedReporter,
  state: State,
  { step, question, recordClass, scope, preferences, ontology }: InitializeAction["payload"]
) {

  // only use reporters configured for the report download page
  let availableReporters = recordClass.formats.filter(reporter => reporter.scopes.indexOf(scope) > -1);

  // set portion of static page state not loaded automatically
  let partialState = Object.assign({}, state, { step, question, recordClass, scope, availableReporters, preferences, ontology });

  return tryFormInit(getSelectedReporter, partialState);
}

function tryFormInit(getSelectedReporter: GetSelectedReporter, state: State) {
  // try to calculate form state for WDK JSON reporter
  if (state.preferences != null && state.ontology != null && state.step != null && state.recordClass != null) {
    // step, preferences, and ontology have been loaded;
    //    calculate state and set isLoading to false
    let selectedReporterName = (state.availableReporters.length == 1 ?
        state.availableReporters[0].name : null);
    return Object.assign({}, state, {
      isLoading: false,
      selectedReporter: selectedReporterName
    },
    getSelectedReporter(selectedReporterName, state.recordClass.name).getInitialState(state));
  }

  // one of the initialize actions has not yet been sent
  return state;
}

function updateReporter(getSelectedReporter: GetSelectedReporter, state: State, selectedReporter: string) {
  // selectedReporter may be undefined or invalid since we are now respecting a query param "preference"
  let reporterFound = state.availableReporters.findIndex(r => r.name === selectedReporter) != -1;
  return !reporterFound || state.recordClass == null ? state :
    Object.assign({}, state, { selectedReporter },
      getSelectedReporter(selectedReporter, state.recordClass.name).getInitialState(state));
}

function updateFormState(state: State, formState: any) {
  return Object.assign({}, state, { formState });
}

function updateFormUiState(state: State, formUiState: any) {
  return Object.assign({}, state, { formUiState });
}