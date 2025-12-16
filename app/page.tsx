import { Carousel } from 'components/carousel';
import { ThreeItemGrid } from 'components/grid/three-items';
import Footer from 'components/layout/footer';

//TEST AWIN SETUP
(function (w) {
  // --- CONFIG ---
  const advertiserId = 41646;
  const cookieDomain = '.awinstartupteamuk.myshopify.com';

  // --- Storefront API config ---
  var SHOP_DOMAIN = 'awinstartupteamuk.myshopify.com';
  var API_VERSION = '2025-01'; // or the version you target
  var STOREFRONT_ACCESS_TOKEN = '2806a1109ba8d45ab291acaae9c18427';
  var STOREFRONT_ENDPOINT = 'https://' + SHOP_DOMAIN + '/api/' + API_VERSION + '/graphql.json';

  function readCookiesAsString(awRegEx?: RegExp | string) {
    var aCookies = document.cookie.split(';');
    var cookies = [];
    for (var i = 0; i < aCookies.length; i++) {
      var aParts = aCookies[i].split('=');
      if (awRegEx.test(aParts[0])) {
        cookies.push(aParts[1]);
      }
    }
    return cookies.join(',');
  }

  function getAwc() {
    var rx = new RegExp('[?&]awc=([^&]+).*$');
    var returnVal = document.location.href.match(rx);

    if (returnVal !== null) {
      if (returnVal[1] && returnVal[1].match(/[0-9]+_[0-9]+_[a-zA-Z0-9]+/)) {
        return returnVal[1];
      }
    }
    // cookies
    var awcFromCookie = readCookiesAsString(/_aw_m_\d+/);
    var awcFromSnCookie = readCookiesAsString(/_aw_sn_\d+/);

    if (awcFromCookie.length > 0 && awcFromSnCookie.length > 0) {
      return awcFromCookie + ',' + awcFromSnCookie;
    } else if (awcFromCookie.length > 0) {
      return awcFromCookie;
    } else if (awcFromSnCookie.length > 0) {
      return awcFromSnCookie;
    }

    return '';
  }

  function getSource() {
    var rx = new RegExp('[?&]source=([^&]+).*$');
    var returnVal = document.location.href.match(rx);

    if (returnVal !== null) {
      var validatedValue = returnVal[1].replace(/[^a-zA-Z0-9-_]/g, '');
      return validatedValue;
    }

    var sourceFromCookie = readCookiesAsString(/_aw_channel$/);

    if (sourceFromCookie.length > 0) {
      return sourceFromCookie;
    }

    return '';
  }

  function setPxCookie(awc) {
    var cookieName = '_awc_' + advertiserId;
    var expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = cookieName + '=' + awc + ';expires=' + expires.toGMTString() + ';path=/;domain=' + cookieDomain;
  }

  function setSourceCookie(source, expiresOverrideDate) {
    var cookieName = '_aw_channel';
    var expires = new Date();
    if (expiresOverrideDate) {
      expires.setTime(expiresOverrideDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
    var cookieValue = source.indexOf('|') !== -1 ? source : source + '|' + Math.round(expires.getTime() / 1000);
    document.cookie = cookieName + '=' + cookieValue + ';expires=' + expires.toGMTString() + ';path=/;domain=' + cookieDomain;
  }

  function addMasterTag(advertiserId) {
    var masterTagScript = document.createElement('script');
    masterTagScript.type = 'text/javascript';
    masterTagScript.setAttribute('defer', 'defer');
    masterTagScript.src = 'https://www.dwin1.com/' + advertiserId + '.js';
    document.body.appendChild(masterTagScript);
  }

  // ---------- NEW: Storefront API helpers ----------
  function gql(query, variables) {
    return fetch(STOREFRONT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
      },
      body: JSON.stringify({ query: query, variables: variables })
    }).then(function (r) { return r.json(); });
  }

  function getStoredCartId() {
    try { return localStorage.getItem('shopify_cart_id') || ''; } catch(e) { return ''; }
  }

  function storeCartId(id) {
    try { localStorage.setItem('shopify_cart_id', id); } catch(e) {}
  }

  function ensureCartId() {
    var existing = getStoredCartId();
    if (existing) return Promise.resolve(existing);

    var CREATE = `
      mutation CreateCart {
        cartCreate { cart { id } userErrors { field message } }
      }
    `;
    return gql(CREATE, {}).then(function (res) {
      var id = res && res.data && res.data.cartCreate && res.data.cartCreate.cart && res.data.cartCreate.cart.id;
      if (!id) throw new Error('Failed to create cart');
      storeCartId(id);
      return id;
    });
  }

  // ---------- REPLACES setCartNoteAttributes(): cart-level attributes ----------
  function setCartAttributesWithStorefront(pAwc, pSource) {
    var attrs = [];
    if (pSource) attrs.push({ key: '__awin_channel', value: pSource });
    if (pAwc)    attrs.push({ key: '__awc',          value: pAwc });

    if (!attrs.length) return Promise.resolve();

    var MUTATION = `
      mutation CartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
        cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
          cart { id attributes { key value } }
          userErrors { field message }
        }
      }
    `;

    return ensureCartId().then(function (cartId) {
      return gql(MUTATION, { cartId: cartId, attributes: attrs });
    }).then(function (res) {
      var errs = res && res.data && res.data.cartAttributesUpdate && res.data.cartAttributesUpdate.userErrors;
      if (errs && errs.length) {
        console.warn('cartAttributesUpdate errors:', errs);
      }
    }).catch(function (e) {
      console.warn('Storefront API cartAttributesUpdate failed:', e);
    });
  }

  // ---------- run() with async Storefront call ----------
  function run() {
    var awc = getAwc(advertiserId);
    var fullSourceValue = getSource();

    if (advertiserId) {
      if (awc || fullSourceValue) {
        var source = (fullSourceValue || '').split('|')[0] || '';
        setCartAttributesWithStorefront(awc, source).then(function () {
          if (awc) setPxCookie(awc);
        });
      }

      if (fullSourceValue !== '') {
        if (fullSourceValue.indexOf('|') !== -1) {
          var sourceParts = fullSourceValue.split('|');
          var sourceDate = new Date(parseInt(sourceParts[1], 10) * 1000);
          setSourceCookie(fullSourceValue, sourceDate);
        } else {
          setSourceCookie(fullSourceValue);
        }
      }

      addMasterTag(advertiserId);
    }
  }

  w.AWIN = w.AWIN || {};
  w.AWIN.Shopify = { run: run };
})(window);

AWIN.Shopify.run();
//END TEST AWIN SETUP


export const metadata = {
  description:
    'High-performance ecommerce store built with Next.js, Vercel, and Shopify.',
  openGraph: {
    type: 'website'
  }
};

export default function HomePage() {
  return (
    <>
      <ThreeItemGrid />
      <Carousel />
      <Footer />
    </>
  );
}
