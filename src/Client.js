import axios from "axios";
import { isEnabled, getVariant } from "./assignmentLogic.js";
import { v4 as uuid } from "uuid";

class Client {
  constructor(config) {
    this.config = config;
    this.context = undefined;
    this.experiments = {};
  }

  // If userId is not provided as context, one will be automatically generated
  addContext(req, contextObj) {
    if (!contextObj || !contextObj.userID) {
      this.context = { ...contextObj, userID: uuid(), ip: req.ip };
    } else if (!contextObj.ip) {
      this.context = { ...contextObj, ip: req.ip };
    } else {
      this.context = contextObj;
    }
  }

  async getFeatureValue(name) {
    let experiment = this.experiments.filter((exp) => exp.name === name)[0];

    if (experiment.type_id != 3) {
      return await isEnabled(this.experiments, name, this.context.userID);
    } else {
      let enabled = await isEnabled(
        this.experiments,
        name,
        this.context.userID
      );
      let variant = await getVariant(
        this.experiments,
        name,
        this.context.userID
      );
      let users = await this.#getUsers();
      let existingUser = users.filter(
        (user) =>
          user.id === this.context.userID && user.variant_id === variant.id
      )[0];
      if (enabled && variant && !existingUser) {
        this.#createUser({
          id: this.context.userID,
          variant_id: variant.id,
          ip_address: this.context.ip,
        });
      }
      return enabled && variant;
    }
  }

  async getExperiments() {
    let experiments;
    try {
      experiments = await axios.get(
        `${this.config.serverAddress}/api/experiment`
      );
      this.experiments = experiments.data;
    } catch (error) {
      console.log("Error fetching experiments", error);
    }
  }

  timedFetch(interval) {
    if (interval > 0) {
      this.timer = setInterval(
        () => this.fetchExperiments(),
        this.config.interval
      );
    }
  }

  async fetchExperiments() {
    let experiments;
    const lastModified = new Date(Date.now() - this.config.interval);
    try {
      const config = {
        headers: {
          "If-Modified-Since": lastModified.toUTCString(),
        },
      };
      experiments = await axios.get(
        `${this.config.serverAddress}/api/experiment`,
        config
      );
      if (experiments.status === 304) {
        return this.experiments;
      }
      return (this.experiments = experiments.data);
    } catch (error) {
      console.log("Error fetching experiments:", error);
    }
  }

  async #getUsers() {
    try {
      let users = await axios.get(`${this.config.serverAddress}/api/users`);
      return users.data;
    } catch (error) {
      console.log("Error fetching users:", error);
    }
  }

  async #createUser({ id, variant_id, ip_address }) {
    try {
      const response = await axios.post(
        `${this.config.serverAddress}/api/users`,
        {
          id,
          variant_id,
          ip_address,
        }
      );
      return response.data;
    } catch (error) {
      console.log("error creating user", error);
      return error.data;
    }
  }

  async createEvent({ variant_id, user_id }) {
    try {
      const response = await axios.post(
        `${this.config.serverAddress}/api/events`,
        {
          variant_id,
          user_id,
        }
      );
      return response.data;
    } catch (error) {
      return error.data;
    }
  }
}

export default Client;
