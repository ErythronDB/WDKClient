import * as React from 'react';
import { Link } from "react-router-dom";
import Banner from 'wdk-client/Components/Banners/Banner';
import { IconAlt } from 'wdk-client/Components';
import { StrategyActions } from './StrategyControls';

export default function UnownedStrategy() {
  return (
    <Banner banner={{
      type: 'danger',
      message: <div style={{ fontSize: '1.25em' }}>
        The requested strategy does not exist.  Please double check your share link.<br/>
        If another user is sharing a strategy with you, ask them to use the share button (<IconAlt fa={StrategyActions.share.iconName}/>) in their panel, 
          to generate a valid URL that you may use to make a copy of their strategy.  <br />
         <br />
        <Link to="/workspace/strategies">Dismiss</Link>
      </div>
    }}/>
  );
}
