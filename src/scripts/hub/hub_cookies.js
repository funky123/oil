import {
  OIL_CONFIG_DEFAULT_VERSION,
  OIL_PAYLOAD_CONFIG_VERSION,
  OIL_PAYLOAD_CUSTOM_PURPOSES, OIL_PAYLOAD_CUSTOM_VENDORLIST_VERSION,
  OIL_PAYLOAD_LOCALE_VARIANT_NAME,
  OIL_PAYLOAD_LOCALE_VARIANT_VERSION,
  OIL_PAYLOAD_PRIVACY,
  OIL_PAYLOAD_VERSION,
  OIL_SPEC
} from '../core/core_constants';
import { logError, logInfo } from '../core/core_log';
import { getConfigVersion, getCookieExpireInDays, getLanguageFromLocale } from '../core/core_config';
import { getLimitedVendorIds } from '../core/core_vendor_lists';
import { findCookieConsideringCookieVersions, getStandardPurposesWithConsent, setDomainCookie } from '../core/core_cookies';
import Cookie from 'js-cookie';

const {ConsentString} = require('consent-string');

const OIL_HUB_DOMAIN_COOKIE_NAME = 'oil_data';
const OIL_HUB_UNKNOWN_VALUE = 'unknown';

export function getPoiCookie(groupName = '') {
  let cookieConfig = getHubDomainCookieConfig(groupName);
  let cookie = findCookieConsideringCookieVersions(cookieConfig, transformOutdatedOilCookie);
  logInfo('Oil Hub Domain Cookie: ', cookie);
  return cookie;
}

export function setPoiCookie(groupName, payload) {
  // If we send OLD DATA to a NEW HUB, we got a problem - in this case we do not want to store the POI-Cookie --> new data = consent string, old = privacy object
  let consentStringAsPrivacy = getConsentStringFromPayload(payload);
  if (payload && (typeof (consentStringAsPrivacy) === 'string')) {
    let cookie = {
      power_opt_in: true,
      version: getVersionFromPayload(payload),
      localeVariantName: getLocaleVariantNameFromPayload(payload),
      localeVariantVersion: getLocaleVariantVersionFromPayload(payload),
      customPurposes: getCustomPurposesFromPayload(payload),
      customVendorListVersion: getCustomVendorlistVersionFromPayload(payload),
      consentString: consentStringAsPrivacy,
      configVersion: getConfigVersionFromPayload(payload)
    };
    setDomainCookie(getOilHubCookieName(groupName), cookie, getCookieExpireInDays());
  } else {
    logError('Oil Hub received old or empty payload! No POI cookie stored.')
  }
}

function transformOutdatedOilCookie(cookieConfig) {
  let cookieJson = Cookie.getJSON(cookieConfig.name);

  let cookie = cookieConfig.defaultCookieContent;
  cookie.power_opt_in = cookieJson.power_opt_in;
  cookie.version = cookieJson.version;
  cookie.configVersion = OIL_CONFIG_DEFAULT_VERSION;
  cookie.localeVariantName = cookieJson.localeVariantName;
  cookie.localeVariantVersion = cookieJson.localeVariantVersion;
  cookie.customPurposes = []; // we do not know custom purposes config in the hub, but old cookies does not encode them
  cookie.consentData.setConsentLanguage(getLanguageFromLocale(cookieJson.localeVariantName));
  cookie.consentData.setPurposesAllowed(getStandardPurposesWithConsent(cookieJson.privacy));
  cookie.consentData.setVendorsAllowed(getLimitedVendorIds());
  return cookie;
}

function getOilHubCookieName(groupName) {
  if (groupName) {
    return groupName + '_' + OIL_HUB_DOMAIN_COOKIE_NAME;
  }
  return OIL_HUB_DOMAIN_COOKIE_NAME;
}

function getHubDomainCookieConfig(groupName) {
  let consentData = new ConsentString();
  consentData.setCmpId(OIL_SPEC.CMP_ID);
  consentData.setCmpVersion(OIL_SPEC.CMP_VERSION);
  consentData.setConsentScreen(1);

  consentData.setConsentLanguage('en'); // this value can't be figured out
  consentData.setPurposesAllowed([]);
  consentData.setVendorsAllowed([]);

  return {
    name: getOilHubCookieName(groupName),
    expires: getCookieExpireInDays(),
    defaultCookieContent: {
      power_opt_in: false,
      version: OIL_HUB_UNKNOWN_VALUE, // this value can't be figured out
      localeVariantName: OIL_HUB_UNKNOWN_VALUE, // this value can't be figured out
      localeVariantVersion: 0, // this value can't be figured out
      customPurposes: [],
      consentData: consentData,
      consentString: '', // consent string is not computed because global vendor list is not loaded in hub
      configVersion: getConfigVersion()
    },
    outdated_cookie_content_keys: ['power_opt_in', 'timestamp', 'version', 'localeVariantName', 'localeVariantVersion', 'privacy']
  };
}

function getConsentStringFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_PRIVACY, 'undefined');
}

function getConfigVersionFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_CONFIG_VERSION, OIL_CONFIG_DEFAULT_VERSION);
}

function getCustomPurposesFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_CUSTOM_PURPOSES, []);
}

function getCustomVendorlistVersionFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_CUSTOM_VENDORLIST_VERSION, 'undefined');
}

function getVersionFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_VERSION);
}

function getLocaleVariantNameFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_LOCALE_VARIANT_NAME);
}


function getLocaleVariantVersionFromPayload(payload) {
  return getPayloadPropertyOrDefault(payload, OIL_PAYLOAD_LOCALE_VARIANT_VERSION);
}

function getPayloadPropertyOrDefault(payload, pname, defaultValue) {
  if (payload && payload[pname]) {
    return payload[pname];
  }
  if (defaultValue === 'undefined') {
    return undefined;
  }
  return defaultValue || OIL_HUB_UNKNOWN_VALUE;
}
