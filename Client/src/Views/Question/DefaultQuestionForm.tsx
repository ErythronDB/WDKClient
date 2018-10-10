import * as React from 'react';

import { HelpIcon, IconAlt } from '../../Components';
import { DispatchAction } from '../../Core/CommonTypes';
import { makeClassNameHelper } from '../../Utils/ComponentUtils';
import { Seq } from '../../Utils/IterableUtils';
import { Parameter, ParameterGroup } from '../../Utils/WdkModel';
import ParameterComponent from './ParameterComponent';
import { QuestionState } from './QuestionStoreModule';
import { GroupVisibilityChangedAction, ParamValueUpdatedAction, QuestionSubmitted, QuestionCustomNameUpdated, QuestionWeightUpdated } from './QuestionActionCreators';
import './DefaultQuestionForm.scss';

type EventHandlers = {
  setGroupVisibility: typeof GroupVisibilityChangedAction.create,
  updateParamValue: typeof ParamValueUpdatedAction.create
}

type Props = {
  state: QuestionState;
  dispatchAction: DispatchAction;
  eventHandlers: EventHandlers;
}

const cx = makeClassNameHelper('wdk-QuestionForm');
const tooltipPosition = { my: 'right center', at: 'left center' };

export default function DefaultQuestionForm(props: Props) {
  const { state, eventHandlers, dispatchAction } = props
  return (
    <div className={cx()}>
      <h1>{state.question.displayName}</h1>
      <form onSubmit={e => e.preventDefault() && dispatchAction(QuestionSubmitted.create({ questionName: state.question.urlSegment })) }>
        {state.question.groups
          .filter(group => group.displayType !== 'hidden')
          .map(group =>
            <Group
              key={group.name}
              questionName={state.question.urlSegment}
              group={group}
              uiState={state.groupUIState[group.name]}
              onVisibilityChange={eventHandlers.setGroupVisibility}
            >
              <ParameterList
                questionName={state.question.urlSegment}
                dispatch={props.dispatchAction}
                parameterMap={state.question.parametersByName}
                parameters={group.parameters}
                paramValues={state.paramValues}
                paramUIState={state.paramUIState}
                onParamValueChange={eventHandlers.updateParamValue}
              />
            </Group>
          )
        }
        <div className={cx('SubmitSection')}>
          <button type="submit" className="btn">
            Get Answer
          </button>
          <div>
            <HelpIcon tooltipPosition={tooltipPosition}>Give this search strategy a custom name. The name will appear in the first step box (truncated to 15 characters).</HelpIcon>
            <input
              type="text"
              placeholder="Give this search a name (optional)"
              value={state.customName}
              onChange={e => dispatchAction(QuestionCustomNameUpdated.create({ questionName: state.question.urlSegment, customName: e.target.value }))}
            />
          </div>
          <div>
            <HelpIcon tooltipPosition={tooltipPosition}>Give this search a weight (for example 10, 200, -50, integer only). It will show in a column in your result. In a search strategy, unions and intersects will sum the weights, giving higher scores to items found in multiple searches. Default weight is 10.</HelpIcon>
            <input
              type="text"
              pattern="[+-]?\d*"
              placeholder="Give this search a weight (optional)"
              value={state.weight}
              onChange={e => dispatchAction(QuestionWeightUpdated.create({ questionName: state.question.urlSegment, weight: e.target.value }))}
            />
          </div>
        </div>
      </form>
    </div>
  )
}

type GroupProps = {
  questionName: string;
  group: ParameterGroup;
  uiState: any;
  onVisibilityChange: EventHandlers['setGroupVisibility'];
  children: React.ReactChild;
}

function Group(props: GroupProps) {
  switch(props.group.displayType) {
    case 'ShowHide':
      return <ShowHideGroup {...props}/>

    default:
      return <div>{props.children}</div>;
  }
}

function ShowHideGroup(props: GroupProps) {
  const { questionName, group, uiState: { isVisible }, onVisibilityChange } = props;
  return (
    <div className={cx('ShowHideGroup')} >
      <button
        type="button"
        className={cx('ShowHideGroupToggle')}
        onClick={() => {
          onVisibilityChange({
            questionName,
            groupName: group.name,
            isVisible: !isVisible
          })
        }}
      >
        <IconAlt fa={`caret-${isVisible ? 'down' : 'right'}`}/> {group.displayName}
      </button>
      <div className={cx('ShowHideGroupContent')} >
        {isVisible ? props.children : null}
      </div>
    </div>
  )
}


type ParameterListProps = {
  questionName: string;
  parameters: string[];
  parameterMap: Record<string, Parameter>;
  paramValues: Record<string, string>;
  paramUIState: Record<string, any>;
  onParamValueChange: EventHandlers['updateParamValue'];
  dispatch: DispatchAction;
}
function ParameterList(props: ParameterListProps) {
  const { dispatch, parameters, parameterMap, paramValues, paramUIState, questionName, onParamValueChange } = props;
  return (
    <div className={cx('ParameterList')}>
      {Seq.from(parameters)
        .map(paramName => parameterMap[paramName])
        .map(parameter => (
          <React.Fragment key={parameter.name}>
            <ParameterHeading parameter={parameter}/>
            <div className={cx('ParameterControl')}>
              <ParameterComponent
                ctx={{
                  questionName,
                  parameter,
                  paramValues
                }}
                parameter={parameter}
                value={paramValues[parameter.name]}
                uiState={paramUIState[parameter.name]}
                onParamValueChange={paramValue => {
                  onParamValueChange({
                    questionName,
                    parameter,
                    paramValues,
                    paramValue
                  })
                }}
                dispatch={dispatch}
              />
            </div>
          </React.Fragment>
        ))}
    </div>
  )
}

function ParameterHeading(props: { parameter: Parameter}) {
  const { parameter } = props;
  return (
    <div className={cx('ParameterHeading')} >
      <h2>
        <HelpIcon>{parameter.help}</HelpIcon> {parameter.displayName}
      </h2>
    </div>
  )
}

