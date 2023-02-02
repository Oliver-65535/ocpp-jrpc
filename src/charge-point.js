class ChargePoint {
  constructor(identity, client) {
    this.identity = identity;
    this.client = client;
  }

  async getNumConnectors() {
    const response = await this.client.call("GetConfiguration");
    return response.configurationKey.find((key) => key.key === "NumberOfConnectors").value;
  }
}

module.exports = ChargePoint;
