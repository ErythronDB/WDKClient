import { isEqual } from 'lodash';
import * as React from 'react';
import { connect } from 'react-redux';

import * as UserActionCreators from 'wdk-client/Actions/UserActions';
import PageController from 'wdk-client/Core/Controllers/PageController';
import { wrappable } from 'wdk-client/Utils/ComponentUtils';
import RecordUI from 'wdk-client/Views/Records/RecordUI';
import {
  loadRecordData,
  RecordRequestOptions,
  updateAllFieldVisibility,
  updateNavigationCategoryExpansion,
  updateNavigationQuery,
  updateNavigationVisibility,
  updateSectionVisibility,
} from 'wdk-client/Actions/RecordActions';

import { CategoryTreeNode } from 'wdk-client/Utils/CategoryUtils';
import { RecordClass } from 'wdk-client/Utils/WdkModel';
import { getAttributeNames, getTableNames } from 'wdk-client/Views/Records/RecordUtils';
import { RootState } from 'wdk-client/Core/State/Types';

const ActionCreators = {
  ...UserActionCreators,
  loadRecordData,
  updateSectionVisibility,
  updateNavigationQuery,
  updateAllFieldVisibility,
  updateNavigationCategoryExpansion,
  updateNavigationVisibility
};

type StateProps = RootState['record'];
type DispatchProps = typeof ActionCreators;
type Props = StateProps & DispatchProps;

// FIXME Remove when RecordUI is converted to Typescript
const CastRecordUI: any = RecordUI;

/** View Controller for record page */
class RecordController extends PageController<Props> {

  /**
   * Declare what fields of the record are needed. All requests are made in
   * parallel, but the first requests is required to render the page.
   *
   * By default, two elements are returned. The first includes all atrributes,
   * and the second includes all tables. In some cases, more granular control
   * might be required, which this function hook provides.
   */
  getRecordRequestOptions(recordClass: RecordClass, categoryTree: CategoryTreeNode): RecordRequestOptions[] {
    return [
      // all attributes
      {
        attributes: getAttributeNames(categoryTree),
        tables: []
      },
      // all tables
      {
        attributes: [],
        tables: getTableNames(categoryTree)
      }
    ]
  }

  isRenderDataLoaded() {
    return (
      this.props.recordClass != null &&
      this.props.record != null &&
      !this.props.isLoading
    );
  }

  isRenderDataLoadError() {
    return (
      this.props.error != null &&
      this.props.error.status !== 404 &&
      this.props.record == null
    );
  }

  isRenderDataNotFound() {
    return (
      this.props.error != null &&
      this.props.error.status === 404
    );
  }

  getTitle() {
    return this.props.recordClass.displayName + ' ' + this.props.record.displayName;
  }

  getErrorMessage(status: number) {
    return 'The requested record ' + (status === 404 ?
      'does not exist.' : 'could not be loaded.');
  }

  loadData(previousProps?: this['props']) {
    // load data if params have changed
    if (
      previousProps == null ||
      !isEqual(previousProps.match.params, this.props.match.params)
    ) {
      let { recordClass, primaryKey } = this.props.match.params;
      let pkValues = primaryKey.split('/');
      this.props.loadRecordData(recordClass, pkValues, this.getRecordRequestOptions);
    }
  }

  renderStateError() {
    if (this.props.error == null) return ;

    return (
      <div style={{padding: '1.5em', fontSize: '2em', color: 'darkred', textAlign: 'center'}}>
        {this.getErrorMessage(this.props.error.status)}
      </div>
    );
  }

  renderRecord() {
    if (this.props.record == null) return null;

    let { record, recordClass, inBasket, favoriteId,
      loadingBasketStatus, loadingFavoritesStatus } = this.props;
    let loadingClassName = 'fa fa-circle-o-notch fa-spin';
    let headerActions = [];
    if (recordClass.useBasket) {
      headerActions.push({
        label: inBasket ? 'Remove from basket' : 'Add to basket',
        iconClassName: loadingBasketStatus ? loadingClassName : 'fa fa-shopping-basket',
        onClick: (event: Event) => {
          event.preventDefault();
          this.props.updateBasketStatus(record, !inBasket);
        }
      });
    }
    headerActions.push({
      label: favoriteId ? 'Remove from favorites' : 'Add to favorites',
      className: ' favorites ',
      iconClassName: loadingFavoritesStatus ? loadingClassName : 'fa fa-lg fa-star',
      onClick: (event: Event) => {
        event.preventDefault();
        if (favoriteId) {
          this.props.removeFavorite(record, favoriteId);
        }
        else {
          this.props.addFavorite(record);
        }
      }
    });

    if (recordClass.formats.some(format => format.scopes.includes('record'))) {
      headerActions.push({
        label: 'Download ' + recordClass.displayName,
        iconClassName: 'fa fa-lg fa-download',
        href: '/record/' + recordClass.urlSegment + '/download/' +
          record.id.map(pk => pk.value).join('/')
      });
    }

    return (
      <CastRecordUI {...this.props} headerActions={headerActions} />
    );
  }

  renderView() {
    return (
      <div>
        {this.renderStateError()}
        {this.renderRecord()}
      </div>
    );
  }

}

const enhance = connect<StateProps, DispatchProps, {}, RootState>(
  state => state.record,
  ActionCreators
)

export default enhance(wrappable(RecordController));