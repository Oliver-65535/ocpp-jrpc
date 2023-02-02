export default class ChargePoint {
  constructor(identity, client) {
    this.identity = identity;
    this.client = client;
  }

  async getNumConnectors() {
    const response = await this.client.call("GetConfiguration", {
      key: ["NumberOfConnectors"],
    });
    console.log(response);
    return response;
  }

  async getConfiguration() {
    const response = await this.client.call("GetConfiguration");
    return response.configurationKey;
  }

  async setConfiguration(key, value) {
    const response = await this.client.call("ChangeConfiguration", {
      key,
      value,
    });
    return response;
  }

  async startTransaction({ connectorId, idTag }) {
    const response = await this.client.call("RemoteStartTransaction", {
      connectorId,
      idTag,
    });
    return response;
  }

  async getLocalListVersion() {
    const response = await this.client.call("GetLocalListVersion");
    return parseInt(response.listVersion, 10);
  }
}
