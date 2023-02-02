interface Client {
  call: (method: string, params?: any) => Promise<any>;
}

export default class ChargePoint {
  identity: string;
  client: Client;

  constructor(identity: string, client: Client) {
    this.identity = identity;
    this.client = client;
  }

  async getNumConnectors() {
    const response = await this.client.call("GetConfiguration");
    return response.configurationKey.find((key: { key: string }) => key.key === "NumberOfConnectors").value;
  }

  async startTransaction({ connectorId, idTag }: { connectorId: number; idTag: string }) {
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
