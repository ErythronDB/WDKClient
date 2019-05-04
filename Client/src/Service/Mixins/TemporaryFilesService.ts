import { ServiceBaseClass } from 'wdk-client/Service/ServiceBase';
import { ServiceError } from 'wdk-client/Utils/WdkService';

export default (base: ServiceBaseClass) => class DatasetsService extends base {

 createTemporaryFile(file: File): Promise<string> {
    const formData = new FormData();
    const path = '/temporary-file';
    formData.append('file', file, file.name);
    return fetch(this.serviceUrl + path, {
      method: 'POST',
      credentials: 'include',
      body: formData
    }).then(response => {
      if (response.ok) {
        const id = response.headers.get('ID');
        if (id == null) throw new Error("Expected response headers to include `ID`, but it was not.");
        return Promise.resolve(id);
      }
      return response.text().then(text => {
        throw new ServiceError(
          `Cannot POST ${path} (${response.status})`,
          text,
          response.status
        );
      })
    })
  }

}