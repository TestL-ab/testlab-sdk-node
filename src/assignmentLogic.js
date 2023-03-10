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
  //let feature = features.filter((exp) => exp.name === name)[0];
  let feature = features.experiments
    .concat(features.toggles, features.rollouts)
    .filter((f) => f.name === name)[0];
  if (!feature) return false;

  // Return false if current date is outside of date range for feature or if the feature is not running
  let startDate = new Date(feature.start_date);
  let endDate = new Date(feature.end_date);

  if (!isActive(startDate, endDate) || !feature.is_running) {
    return false;
  }

  // Return false if the hashed ID is outside of the target user_percentage range or outside of the range of a given block

  if (feature.type_id === 2) {
    let hashedID = hashMessage(userID + name);
    return hashedID < feature.user_percentage ? true : false;
  } else if (feature.type_id === 3) {
    let hashedID = hashMessage(userID);
    let blocks = features.userblocks;
    let blockID = Math.ceil(hashedID * blocks.length);

    return !!blocks.filter(
      (b) => b.id === blockID && b.feature_id === feature.id
    )[0];
  }

  return false;
}

function getVariant(features, name, userID) {
  let hashedID = hashMessage(userID);
  console.log("uuid, hashed", userID, hashedID);

  let feature = features.experiments
    .concat(features.toggles, features.rollouts)
    .filter((f) => f.name === name)[0];

  if (!feature) return false;

  let variants = feature.variant_arr;
  let blocks = features.userblocks;
  let blockID = Math.ceil(hashedID * blocks.length);

  let targetBlock = blocks.filter(
    (b) => b.id === blockID && b.feature_id === feature.id
  )[0];

  if (!targetBlock) return false;

  let segmentEnd = targetBlock.id / blocks.length;
  let segmentStart = segmentEnd - 1 / blocks.length;

  let runningTotal = segmentStart;
  for (let i = 0; i < variants.length; i++) {
    runningTotal += variants[i].weight * (1 / blocks.length);
    if (hashedID <= runningTotal) {
      return { id: variants[i].id, value: variants[i].value };
    }
  }
  return false;
}

export { isEnabled, getVariant };
