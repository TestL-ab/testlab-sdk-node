import crypto from "crypto";
import { TextEncoder } from "util";

async function hashMessage(message) {
  // Ensure that the message is a string
  message = String(message);

  // Use SHA-256 hashing algorithm to hash the message string
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);

  // Convert the hash to a 32-bit unsigned integer
  const hashArray = new Uint32Array(hash);
  const hashValue = hashArray[0];

  // Map the hash value to a value between 0 and 1
  const maxValue = Math.pow(2, 32) - 1;
  const mappedValue = hashValue / maxValue;

  return mappedValue;
}

async function isEnabled(experiments, name, userID) {
  // Find target experiment based on name
  let experiment = experiments.filter((exp) => exp.name === name)[0];
  if (!experiment) {
    throw new TypeError("Provided name does not match any experiment.");
  }

  // Return false if current date is outside of date range for experiment
  let startDate = new Date(experiment.start_date);
  let endDate = new Date(experiment.end_date);
  let currentDate = new Date();

  if (currentDate > endDate || currentDate < startDate) {
    return false;
  }

  // Return false if experiment is not running (toggled off) or if the hashed ID is outside of the target user_percentage range

  // For Type 3 (experiments), users can only be assigned to one experiment (total percentage of users enrolled in experiments can not exceed 100%)

  if (experiment.type_id === 1) {
    return experiment.is_running ? true : false;
  } else if (experiment.type_id === 2) {
    let hashedID = await hashMessage(userID + name);
    return experiment.is_running && hashedID < experiment.user_percentage
      ? true
      : false;
  } else if (experiment.type_id === 3) {
    let hashedID = await hashMessage(userID);

    let type3Experiments = experiments.filter((exp) => exp.type_id === 3);
    let [segmentStart, segmentEnd] = [0, 0];

    for (let i = 0; i < type3Experiments.length; i++) {
      segmentEnd += type3Experiments[i].user_percentage;
      if (
        hashedID >= segmentStart &&
        hashedID <= segmentEnd &&
        type3Experiments[i].name === name
      ) {
        return true;
      } else {
        segmentStart = segmentEnd;
      }
    }
  }

  return false;
}

async function getVariant(experiments, name, userID) {
  let hashedID = await hashMessage(userID);
  console.log("uuid, hashed", userID, hashedID);

  let experiment = experiments.filter((exp) => exp.name === name)[0];
  if (!experiment) {
    throw new TypeError("Provided name does not match any experiment.");
  }
  let variants = experiment.variant_arr;
  let type3Experiments = experiments.filter((exp) => exp.type_id === 3);
  let [segmentStart, segmentEnd] = [0, 0];

  for (let i = 0; i < type3Experiments.length; i++) {
    segmentEnd += type3Experiments[i].user_percentage;
    if (
      hashedID >= segmentStart &&
      hashedID <= segmentEnd &&
      type3Experiments[i].name === name
    ) {
      let runningTotal = segmentStart;
      for (let i = 0; i < variants.length; i++) {
        runningTotal += variants[i].weight * variants[i].weight;
        if (hashedID <= runningTotal) {
          return variants[i];
        }
      }
    } else {
      segmentStart = segmentEnd;
    }
  }
  return false;
}

export { isEnabled, getVariant };
