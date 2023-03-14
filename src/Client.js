import axios from "axios";
import { isEnabled, getVariant } from "./assignmentLogic.js";
import { v4 as uuid } from "uuid";

class Client {
  constructor(config) {
    this.config = config;
    this.context = undefined;
    this.features = {};
  }

  async addDefaultContext() {
    let ipObj = await this.getIp();
    let ip = ipObj.ip;
    this.context = { userID: uuid(), ip: ip };
  }

  updateContext(contextObj) {
    this.context = { ...this.context, ...contextObj };
  }

  async getIp() {
    const response = await axios.get("https://ipapi.co/json/");
    return response.data;
  }

  getFeatureValue(name) {
    let feature = this.features.experiments
      .concat(this.features.toggles, this.features.rollouts)
      .filter((f) => f.name === name)[0];
    if (!feature) return false;

    if (feature.type_id != 3) {
      return isEnabled(this.features, name, this.context.userID);
    } else {
      let enabled = isEnabled(this.features, name, this.context.userID);
      let variant = getVariant(this.features, name, this.context.userID);
      this.getUsers()
        .then((users) => {
          let existingUser = users.filter(
            (user) =>
              user.id === this.context.userID && user.variant_id === variant.id
          )[0];
          if (enabled && variant && !existingUser) {
            this.createUser({
              id: this.context.userID,
              variant_id: variant.id,
              ip_address: this.context.ip,
            });
          }
        })
        .catch((error) =>
          console.log("Unable to retrieve existing users", error)
        );
      return enabled && variant;
    }
  }

  timedFetch(interval) {
    if (interval > 0) {
      this.timer = setInterval(
        () => this.fetchFeatures(),
        this.config.interval
      );
    }
  }

  async fetchFeatures() {
    let features;
    const lastModified = new Date(Date.now() - this.config.interval);
    try {
      if (Object.keys(this.features).length === 0) {
        features = await axios.get(
          `${this.config.serverAddress}/api/feature/current`
        );
      } else {
        const config = {
          headers: {
            "If-Modified-Since": lastModified.toUTCString(),
          },
          validateStatus: function (status) {
            return status >= 200 && status <= 304; // default
          },
        };
        features = await axios.get(
          `${this.config.serverAddress}/api/feature/current`,
          config
        );
        if (features.status === 304) {
          return this.features;
        }
      }
      return (this.features = features.data);
    } catch (error) {
      console.log("Error fetching features:", error);
    }
  }

  async getUsers() {
    try {
      let users = await axios.get(`${this.config.serverAddress}/api/users`);
      return users.data;
    } catch (error) {
      console.log("Error fetching users:", error);
    }
  }

  async createUser({ id, variant_id, ip_address }) {
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
