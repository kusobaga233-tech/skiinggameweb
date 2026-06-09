export interface RuntimeConfig {
  bodySteerGain?: number;
  bodySteerDeadzone?: number;
  bodySteerAlpha?: number;
  bodySteerCurveExponent?: number;
  bodySteerGameplayScale?: number;
  maxForwardSpeed?: number;
  downhillSpeedBoost?: number;
  accelerationResponse?: number;
  driveSpeedBoost?: number;
  driveDownhillSynergy?: number;
  maxTuckSpeedBonusRatio?: number;
  startSpeedLimit?: number;
  pumpImpulseBoost?: number;
  carveRadiusMin?: number;
  carveRadiusMax?: number;
  lowSpeedTurnScale?: number;
  carveRadiusInputBias?: number;
  carveRadiusInputFloor?: number;
  turnSnowplowSteerStart?: number;
  turnSnowplowSteerRelease?: number;
  turnSnowplowSteerFull?: number;
  turnSnowplowHoldDuration?: number;
  turnSnowplowReleaseDuration?: number;
  turnSnowplowMinSpeed?: number;
  turnSnowplowMaxBlend?: number;
  turnSnowplowSpeedReduction?: number;
  snowplowStopResponseMin?: number;
  snowplowStopResponseMax?: number;
}

function parseRuntimeConfig(text: string): RuntimeConfig {
  const config: RuntimeConfig = {};

  const setNumber = (key: string, value: string): boolean => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return true;
    }

    if (key === "body_steer_gain") {
      config.bodySteerGain = parsed;
      return true;
    }

    if (key === "body_steer_deadzone") {
      config.bodySteerDeadzone = parsed;
      return true;
    }

    if (key === "body_steer_alpha") {
      config.bodySteerAlpha = parsed;
      return true;
    }

    if (key === "body_steer_curve_exponent") {
      config.bodySteerCurveExponent = parsed;
      return true;
    }

    if (key === "body_steer_gameplay_scale") {
      config.bodySteerGameplayScale = parsed;
      return true;
    }

    if (key === "max_forward_speed") {
      config.maxForwardSpeed = parsed;
      return true;
    }

    if (key === "downhill_speed_boost") {
      config.downhillSpeedBoost = parsed;
      return true;
    }

    if (key === "acceleration_response") {
      config.accelerationResponse = parsed;
      return true;
    }

    if (key === "drive_speed_boost") {
      config.driveSpeedBoost = parsed;
      return true;
    }

    if (key === "drive_downhill_synergy") {
      config.driveDownhillSynergy = parsed;
      return true;
    }

    if (key === "tuck_speed_bonus_ratio") {
      config.maxTuckSpeedBonusRatio = parsed;
      return true;
    }

    if (key === "start_speed_limit") {
      config.startSpeedLimit = parsed;
      return true;
    }

    if (key === "pump_impulse_boost") {
      config.pumpImpulseBoost = parsed;
      return true;
    }

    if (key === "carve_radius_min") {
      config.carveRadiusMin = parsed;
      return true;
    }

    if (key === "carve_radius_max") {
      config.carveRadiusMax = parsed;
      return true;
    }

    if (key === "low_speed_turn_scale") {
      config.lowSpeedTurnScale = parsed;
      return true;
    }

    if (key === "carve_radius_input_bias") {
      config.carveRadiusInputBias = parsed;
      return true;
    }

    if (key === "carve_radius_input_floor") {
      config.carveRadiusInputFloor = parsed;
      return true;
    }

    if (key === "turn_snowplow_steer_start") {
      config.turnSnowplowSteerStart = parsed;
      return true;
    }

    if (key === "turn_snowplow_steer_release") {
      config.turnSnowplowSteerRelease = parsed;
      return true;
    }

    if (key === "turn_snowplow_steer_full") {
      config.turnSnowplowSteerFull = parsed;
      return true;
    }

    if (key === "turn_snowplow_hold_duration") {
      config.turnSnowplowHoldDuration = parsed;
      return true;
    }

    if (key === "turn_snowplow_release_duration") {
      config.turnSnowplowReleaseDuration = parsed;
      return true;
    }

    if (key === "turn_snowplow_min_speed") {
      config.turnSnowplowMinSpeed = parsed;
      return true;
    }

    if (key === "turn_snowplow_max_blend") {
      config.turnSnowplowMaxBlend = parsed;
      return true;
    }

    if (key === "turn_snowplow_speed_reduction") {
      config.turnSnowplowSpeedReduction = parsed;
      return true;
    }

    if (key === "snowplow_stop_response_min") {
      config.snowplowStopResponseMin = parsed;
      return true;
    }

    if (key === "snowplow_stop_response_max") {
      config.snowplowStopResponseMax = parsed;
      return true;
    }

    return false;
  };

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    setNumber(key, value);
  }

  return config;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("/config.txt", {
      cache: "no-store"
    });
    if (!response.ok) {
      return {};
    }

    return parseRuntimeConfig(await response.text());
  } catch {
    return {};
  }
}
