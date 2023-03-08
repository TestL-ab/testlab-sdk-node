import Client from "./Client.js";

class Config {
  constructor(serverAddress, interval) {
    this.serverAddress = serverAddress;
    this.interval = interval * 1000;
  }

  async connect() {
    const client = new Client(this);
    await client.getFeatures();
    await client.addDefaultContext();
    client.timedFetch(this.interval);
    return client;
  }
}

export default Config;
