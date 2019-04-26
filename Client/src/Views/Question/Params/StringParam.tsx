import { stubTrue as isParamValueValid } from 'lodash';
import React from 'react';

import TextArea from 'wdk-client/Components/InputControls/TextArea';
import TextBox from 'wdk-client/Components/InputControls/TextBox';
import { StringParam, Parameter } from 'wdk-client/Utils/WdkModel';

import { createParamModule, Props } from 'wdk-client/Views/Question/Params/Utils';

export default createParamModule({
  isType,
  isParamValueValid,
  Component
})

function isType(param: Parameter): param is StringParam {
  return param.type === 'string';
}

function Component(props: Props<StringParam, undefined>) {
  const { parameter, value, onParamValueChange } = props;
  return parameter.length <= 50 ? (
    <TextBox
      type="text"
      value={value}
      readOnly={parameter.isReadOnly}
      onChange={onParamValueChange}
    />
  ) : (
    <TextArea
      cols={45}
      rows={Math.ceil(parameter.length / 45)}
      readOnly={parameter.isReadOnly}
      value={value}
      onChange={onParamValueChange}
    />
  );
}
