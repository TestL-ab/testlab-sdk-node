function hashMessage(message) {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return (hash + 2147483647) / 4294967294; // Scale to [0, 1]
}

function isActive(startDate, endDate) {
  let currentDate = new Date();
  return currentDate >= startDate && currentDate <= endDate;
}

function isEnabled(features, name, userID) {
  // Find target feature based on name
  let feature = features.filter((exp) => exp.name === name)[0];
  if (!feature) {
    throw new TypeError("Provided name does not match any feature.");
  }

  // Return false if current date is outside of date range for feature
  let startDate = new Date(feature.start_date);
  let endDate = new Date(feature.end_date);

  if (!isActive(startDate, endDate)) {
    return false;
  }

  // Return false if feature is not running (toggled off) or if the hashed ID is outside of the target user_percentage range

  // For Type 3 (features), users can only be assigned to one feature (total percentage of users enrolled in features can not exceed 100%)

  if (feature.type_id === 1) {
    return feature.is_running ? true : false;
  } else if (feature.type_id === 2) {
    let hashedID = hashMessage(userID + name);
    return feature.is_running && hashedID < feature.user_percentage
      ? true
      : false;
  } else if (feature.type_id === 3) {
    let hashedID = hashMessage(userID);

    let type3features = features.filter(
      (exp) =>
        exp.type_id === 3 &&
        isActive(new Date(exp.start_date), new Date(exp.end_date))
    );
    let [segmentStart, segmentEnd] = [0, 0];

    for (let i = 0; i < type3features.length; i++) {
      segmentEnd += type3features[i].user_percentage;
      if (
        hashedID >= segmentStart &&
        hashedID <= segmentEnd &&
        type3features[i].name === name
      ) {
        return true;
      } else {
        segmentStart = segmentEnd;
      }
    }
  }

  return false;
}

function getVariant(features, name, userID) {
  let hashedID = hashMessage(userID);
  console.log("uuid, hashed", userID, hashedID);

  let feature = features.filter((exp) => exp.name === name)[0];
  if (!feature) {
    throw new TypeError("Provided name does not match any feature.");
  }
  let variants = feature.variant_arr;
  let type3features = features.filter((exp) => exp.type_id === 3);
  let [segmentStart, segmentEnd] = [0, 0];

  for (let i = 0; i < type3features.length; i++) {
    segmentEnd += type3features[i].user_percentage;
    if (
      hashedID >= segmentStart &&
      hashedID <= segmentEnd &&
      type3features[i].name === name
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
