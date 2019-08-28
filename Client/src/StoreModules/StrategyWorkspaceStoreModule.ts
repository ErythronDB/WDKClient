import { defaultTo, difference, union, last } from 'lodash';
import { ActionsObservable, combineEpics, StateObservable } from 'redux-observable';
import { empty, Observable, of, merge } from 'rxjs';
import { mergeMap, mergeMapTo, tap, map, distinctUntilChanged, filter } from 'rxjs/operators';
import { Action } from 'wdk-client/Actions';
import { fulfillDeleteStrategy, fulfillDuplicateStrategy, fulfillPutStrategy, fulfillCreateStrategy, fulfillDeleteOrRestoreStrategies, fulfillStrategy, fulfillPatchStrategyProperties } from 'wdk-client/Actions/StrategyActions';
import { RootState } from 'wdk-client/Core/State/Types';
import { EpicDependencies } from 'wdk-client/Core/Store';
import { openStrategyView, setOpenedStrategies, setOpenedStrategiesVisibility, setActiveStrategy, addNotification, removeNotification, closeStrategyView, addToOpenedStrategies, removeFromOpenedStrategies, clearActiveModal, setActiveModal } from 'wdk-client/Actions/StrategyWorkspaceActions';
import { getValue, preferences, setValue } from 'wdk-client/Preferences';
import { InferAction, switchMapRequestActionsToEpic, mergeMapRequestActionsToEpic, takeEpicInWindow } from 'wdk-client/Utils/ActionCreatorUtils';
import { delay } from 'wdk-client/Utils/PromiseUtils';
import { StrategyDetails, StrategySummary } from 'wdk-client/Utils/WdkUser';
import { requestStrategiesList, fulfillStrategiesList } from 'wdk-client/Actions/StrategyListActions';
import { requestPublicStrategies, fulfillPublicStrategies } from 'wdk-client/Actions/PublicStrategyActions';

export const key = 'strategyWorkspace';

export interface State {
  activeStrategy?: {
    strategyId: number;
    stepId?: number;
  }
  activeModal?: { type: string, strategyId: number }
  isOpenedStrategiesVisible?: boolean;
  openedStrategies?: number[];
  notifications: Record<string, string | undefined>;
  strategySummaries?: StrategySummary[];
  publicStrategySummaries?: StrategySummary[];
}

const initialState: State = {
  notifications: {}
}

export function reduce(state: State = initialState, action: Action): State {
  switch(action.type) {

    case setActiveStrategy.type:
      return {
        ...state,
        activeStrategy: action.payload.activeStrategy
      }

    case setActiveModal.type:
      return { ...state, activeModal: action.payload };

    case clearActiveModal.type:
      return { ...state, activeModal: undefined };

    case setOpenedStrategies.type: {
      const openedStrategies = action.payload.openedStrategies;
      const activeStrategy = state.activeStrategy == null || !openedStrategies.includes(state.activeStrategy.strategyId)
        ? undefined
        : state.activeStrategy;
      return {
        ...state,
        openedStrategies,
        activeStrategy
      }
    }

    case addToOpenedStrategies.type: {
      const openedStrategies = union(state.openedStrategies, action.payload.ids);
      const activeStrategyId = last(openedStrategies);
      const activeStrategy = activeStrategyId == null ? undefined : {
        strategyId: activeStrategyId
      };
      return {
        ...state,
        openedStrategies,
        activeStrategy
      }
    }

    case removeFromOpenedStrategies.type: {
      const openedStrategies = difference(state.openedStrategies, action.payload.ids);
      const activeStrategy = state.activeStrategy == null || !openedStrategies.includes(state.activeStrategy.strategyId)
        ? undefined
        : state.activeStrategy;
      return {
        ...state,
        openedStrategies,
        activeStrategy
      }
    }
    
    case setOpenedStrategiesVisibility.type:
      return {
        ...state,
        isOpenedStrategiesVisible: action.payload.isVisible
      }

    case addNotification.type:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          [action.payload.id]: action.payload.message
        }
      };

    case removeNotification.type:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          [action.payload.id]: undefined
        }
      }

    case fulfillStrategiesList.type:
      return { ...state, strategySummaries: action.payload.strategies };

    case fulfillPublicStrategies.type:
      return { ...state, publicStrategySummaries: action.payload.publicStrategies }

    default:
      return state;
  }
}

export const observe = takeEpicInWindow(
  {
    startActionCreator: openStrategyView,
    endActionCreator: closeStrategyView
  },
  combineEpics(
    updateRouteOnStrategySteptreePutEpic,
    updateRouteOnStrategyDeleteEpic,
    updateRouteOnStrategyDuplicateEpic,
    updatePreferencesEpic,

    switchMapRequestActionsToEpic([openStrategyView], getOpenedStrategiesVisibility),
    switchMapRequestActionsToEpic([openStrategyView, fulfillStrategiesList], getOpenedStrategies),
    switchMapRequestActionsToEpic([setActiveStrategy], appendActiveStrategyToOpenedStrategies),
    switchMapRequestActionsToEpic([openStrategyView], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView], getRequestPublicStrategies),

    mergeMapRequestActionsToEpic([fulfillCreateStrategy], getAddNotification),
    mergeMapRequestActionsToEpic([fulfillDeleteStrategy], getAddNotification),
    mergeMapRequestActionsToEpic([fulfillDuplicateStrategy], getAddNotification),
    mergeMapRequestActionsToEpic([fulfillPutStrategy], getAddNotification),
    mergeMapRequestActionsToEpic([addNotification], getRemoveNotification),

    switchMapRequestActionsToEpic([openStrategyView, fulfillCreateStrategy], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView, fulfillDeleteStrategy], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView, fulfillDeleteOrRestoreStrategies], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView, fulfillStrategy], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView, fulfillPatchStrategyProperties], getRequestStrategiesList),
    switchMapRequestActionsToEpic([openStrategyView, requestStrategiesList], getFulfillStrategiesList,
      { areActionsNew: () => true}),
    switchMapRequestActionsToEpic([openStrategyView, requestPublicStrategies], getFulfillPublicStrategies,
      { areActionsNew: () => true})
  )
);

// We are not using mrate for the next three epics since mrate does not currently allow its requestToFulfill function to return Promise<void>
// XXX Add a router store module to handle route update actions? Then we can convert these to mrates

function updateRouteOnStrategySteptreePutEpic(action$: ActionsObservable<Action>, state$: StateObservable<RootState>, { transitioner }: EpicDependencies): Observable<Action> {
  return action$.pipe(mergeMap(action => {
    if (fulfillPutStrategy.isOfType(action)) {
      // when the active srtrategies step tree is updated, select the root step only if the previous selection was the root before the update
      const { strategy } = action.payload;
      const { activeStrategy } = state$.value[key];
      if (shouldMakeRootStepActive(strategy, activeStrategy)) {
        transitioner.transitionToInternalPage(`/workspace/strategies/${strategy.strategyId}/${strategy.rootStepId}`, { replace: true });
      }
    }
    return empty();
  }));
}

function shouldMakeRootStepActive(strategy: StrategyDetails, activeStrategy?: { strategyId: number, stepId?: number }): boolean {
  if (activeStrategy == null) return true;
  if (activeStrategy.strategyId !== strategy.strategyId) return false;
  if (activeStrategy.stepId == null) return true;
  // single step strategy
  if (strategy.stepTree.primaryInput == null) return true;
  // previous root step is active
  if (strategy.stepTree.primaryInput.stepId === activeStrategy.stepId) return true;
  return false;
}

function updateRouteOnStrategyDeleteEpic(action$: ActionsObservable<Action>, state$: StateObservable<RootState>, { transitioner }: EpicDependencies): Observable<Action> {
  return action$.pipe(mergeMap(action => {
    if (fulfillDeleteStrategy.isOfType(action)) {
      const { strategyId } = action.payload;
      const { activeStrategy, openedStrategies = [] } = state$.value[key];
      const nextOpenedStrategies = openedStrategies.includes(strategyId)
        ? openedStrategies.filter(id => id !== strategyId)
        : openedStrategies;
      if (activeStrategy != null && activeStrategy.strategyId === strategyId) {
        // We could also go to the first opened strategy by inspecting openedStrategies
        transitioner.transitionToInternalPage('/workspace/strategies', { replace: true });
      }
      if (nextOpenedStrategies !== openedStrategies) {
        return of(setOpenedStrategies(nextOpenedStrategies));
      }
    }
    return empty();
  }))
}

function updateRouteOnStrategyDuplicateEpic(action$: ActionsObservable<Action>, state$: StateObservable<RootState>, { transitioner }: EpicDependencies): Observable<Action> {
  return action$.pipe(mergeMap(action => {
    if (fulfillDuplicateStrategy.isOfType(action)) {
      const { strategyId } = action.payload;
      transitioner.transitionToInternalPage(`/workspace/strategies/${strategyId}`, { replace: true });
    }
    return empty();
  }))
}

function updatePreferencesEpic(action$: ActionsObservable<Action>, state$: StateObservable<RootState>, { wdkService }: EpicDependencies): Observable<Action> {
  return merge(
    stateEffect(
      state$,
      state => state[key].openedStrategies,
      openedStrategies => setValue(wdkService, preferences.openedStrategies(), openedStrategies)
    ),
    stateEffect(
      state$,
      state => state[key].isOpenedStrategiesVisible,
      isVisible => setValue(wdkService, preferences.openedStrategiesVisibility(), isVisible)
    )
  );
}

// Perform a side effect based on state changes
function stateEffect<K>(state$: Observable<RootState>, getValue: (state: RootState) => K, effect: (value: NonNullable<K>) => void) {
  return state$.pipe(
    map(getValue),
    filter((value): value is NonNullable<K> => value != null),
    distinctUntilChanged(),
    tap(effect),
    mergeMapTo(empty())
  );
}


// mrate requestToFulfill

async function getOpenedStrategies(
  [openAction, stratListAction]: [InferAction<typeof openStrategyView>, InferAction<typeof fulfillStrategiesList>],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof setOpenedStrategies>> {
  const allUserStrats = stratListAction.payload.strategies;
  const allUserStratIds = new Set(allUserStrats.map(strategy => strategy.strategyId));
  const openedStrategies = defaultTo(await getValue(wdkService, preferences.openedStrategies()), [] as number[])
    .filter(id => allUserStratIds.has(id));
  return setOpenedStrategies(openedStrategies);
}

async function appendActiveStrategyToOpenedStrategies(
  [activeStrategyAction]: [InferAction<typeof setActiveStrategy>]
): Promise<InferAction<typeof addToOpenedStrategies>> {
  const strategyId = activeStrategyAction.payload.activeStrategy && activeStrategyAction.payload.activeStrategy.strategyId;
  return addToOpenedStrategies(strategyId ? [strategyId] : []);
}

async function getOpenedStrategiesVisibility(
  [openAction]: [InferAction<typeof openStrategyView>],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof setOpenedStrategiesVisibility>> {
  return setOpenedStrategiesVisibility(defaultTo(await getValue(wdkService, preferences.openedStrategiesVisibility()), false));
}

type NotifiableAction =
  | InferAction<typeof fulfillDeleteStrategy
  | typeof fulfillDuplicateStrategy
  | typeof fulfillPutStrategy
  | typeof fulfillCreateStrategy>

async function getAddNotification(
  [action]: [NotifiableAction]
): Promise<InferAction<typeof addNotification>> {
  return addNotification(`Your strategy has been ${mapActionToDisplayString(action)}.`);
}

function mapActionToDisplayString(action: NotifiableAction): string {
  switch(action.type) {
    case fulfillCreateStrategy.type:
      return 'created';
    case fulfillDeleteStrategy.type:
      return 'deleted';
    case fulfillDuplicateStrategy.type:
      return 'duplicated';
    case fulfillPutStrategy.type:
      return 'updated';
  }
}

const NOTIFICATION_DURATION_MS = 5000;

async function getRemoveNotification(
  [addAction]: [InferAction<typeof addNotification>]
): Promise<InferAction<typeof removeNotification>> {
  const { id } = addAction.payload;
  await delay(NOTIFICATION_DURATION_MS);
  return removeNotification(id);
}

async function getRequestStrategiesList(
  [openAction, doesnotmatter]: [InferAction<typeof openStrategyView>] | [InferAction<typeof openStrategyView>, unknown],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof requestStrategiesList>> {
  return requestStrategiesList();
}

async function getFulfillStrategiesList(
  [openAction, requestStrategiesListAction]: [InferAction<typeof openStrategyView>, InferAction<typeof requestStrategiesList>],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof fulfillStrategiesList>> {
  return fulfillStrategiesList(await wdkService.getStrategies());
}

async function getRequestPublicStrategies(
  [ openAction ]: [ InferAction<typeof openStrategyView> ],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof requestPublicStrategies>> {
  return requestPublicStrategies();
}

async function getFulfillPublicStrategies(
  [ openAction, requestPublicStrategiesAction ]: [ InferAction<typeof openStrategyView>, InferAction<typeof requestPublicStrategies> ],
  state$: StateObservable<RootState>,
  { wdkService }: EpicDependencies
): Promise<InferAction<typeof fulfillPublicStrategies>> {
  return fulfillPublicStrategies(await wdkService.getPublicStrategies());
}