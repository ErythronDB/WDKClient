import React, { CSSProperties } from 'react';
import { StepAnalysisResultPluginProps } from './StepAnalysisResultsPane';

const divStyle: CSSProperties = { textAlign: 'center' };
const iframeStyle: CSSProperties = { border: 0 };

interface QueryParamFactory {
  (props: StepAnalysisResultPluginProps): string;
}

const generateIframeUrl = (queryParamFactories: [string, QueryParamFactory][], props: StepAnalysisResultPluginProps) => {
  const queryParams = queryParamFactories.map(([key, factory]) => `${key}=${encodeURIComponent(factory(props))}`);
  const queryString = queryParams.join('&');

  return `${props.analysisResult.iframeBaseUrl}?${queryString}`;
}

export const downloadUrlQueryParamFactory = ({ 
  analysisConfig: { analysisId },
  analysisResult: { downloadUrlBase, downloadPath }
}: StepAnalysisResultPluginProps) =>
  `${downloadUrlBase}/stepAnalysisResource.do?analysisId=${analysisId}&path=${downloadPath}`;

export const propertiesUrlQueryParamFactory = ({
  analysisConfig: { analysisId, stepId },
  analysisResult: { accessToken, propertiesUrlBase }
}: StepAnalysisResultPluginProps) =>
  `${propertiesUrlBase}/users/current/steps/${stepId}/analyses/${analysisId}/properties?accessToken=${accessToken}`;

export const contextHashQueryParamFactory = ({
  analysisResult: { contextHash }
}: StepAnalysisResultPluginProps) => encodeURIComponent(contextHash);

export const stepAnalysisExternalResultFactory = (queryParamFactories: [string, QueryParamFactory][]): React.SFC<StepAnalysisResultPluginProps> => (props) =>
  <div style={divStyle}>
    <iframe 
      style={iframeStyle} 
      src={generateIframeUrl(queryParamFactories, props)}
      width={props.analysisResult.iframeWidth}
      height={props.analysisResult.iframeHeight}
    />
  </div>;