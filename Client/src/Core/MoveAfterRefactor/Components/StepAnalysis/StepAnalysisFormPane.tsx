import React, { Fragment } from 'react';
import { StepAnalysisParameter } from '../../../../Utils/StepAnalysisUtils';
import { StepAnalysisErrorsPane } from './StepAnalysisErrorsPane';

type StepAnalysisFormPaneProps = StepAnalysisFormPluginProps & {
  hasParameters: boolean;
  errors: string[];
  formRenderer: (props: StepAnalysisFormPluginProps) => React.ReactNode;
};

export type StepAnalysisFormPluginProps = StepAnalysisFormPluginState & StepAnalysisFormPluginEventHandlers;

export interface StepAnalysisFormPluginState {
  paramSpecs: StepAnalysisParameter[];
  paramValues: Record<string, string[]>;
  formUiState: Record<string, any>;
}

export interface StepAnalysisFormPluginEventHandlers {
  updateParamValues: (newParamValues: Record<string, string[]>) => void;
  updateFormUiState: (newFormState: any) => void;
  onFormSubmit: () => void;
}

export const StepAnalysisFormPane: React.SFC<StepAnalysisFormPaneProps> = ({
  formRenderer,
  hasParameters,
  errors,
  paramSpecs,
  paramValues,
  formUiState,
  updateParamValues,
  updateFormUiState,
  onFormSubmit
}) => (
  <Fragment>
    <StepAnalysisErrorsPane errors={errors} />
    {hasParameters 
      ? formRenderer(
          { 
            paramSpecs, 
            paramValues, 
            formUiState, 
            updateParamValues, 
            updateFormUiState, 
            onFormSubmit 
          }
        )
      : (
        <Fragment>
          <div style={{ textAlign: "center", fontStyle: "italic" }}>
            The analysis results will be shown below.
          </div>
          <hr/>
        </Fragment>
      )
    }
  </Fragment>
);