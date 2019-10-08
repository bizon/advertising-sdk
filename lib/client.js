const got = require('got')
const debug = require('debug')('bizon:advertising-sdk')
const {addSeconds, isAfter} = require('date-fns')

const pkg = require('../package.json')

const endpoints = require('./endpoints')

const USER_AGENT = `bizon/advertising-sdk/${pkg.version} (https://bizon.solutions)`
const TOKEN_ENDPOINT = 'https://api.amazon.com/auth/o2/token'

function getEndpoint(sandbox, region) {
  if (sandbox) {
    debug('Creating advertising client on the Sandbox endpoint')

    return endpoints.sandbox
  }

  if (!region) {
    throw new Error('No region was specified')
  }

  if (region in endpoints) {
    debug(`Creating advertising client on the ${region} region endpoint`)

    return endpoints[region]
  }

  throw new Error(`Unknown region: ${region}`)
}

class Client {
  constructor({
    clientId,
    clientSecret,
    accessToken,
    refreshToken,
    region,
    sandbox
  } = {}) {
    const endpoint = getEndpoint(sandbox, region)

    if (!clientId) {
      throw new Error('No clientId was specified')
    }

    this.clientId = clientId
    this.clientSecret = clientSecret
    this.accessToken = accessToken
    this.refreshToken = refreshToken

    const headers = {
      'user-agent': USER_AGENT,
      'amazon-advertising-api-clientid': this.clientId
    }

    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`
    }

    this.got = got.extend({
      prefixUrl: endpoint,
      headers,
      hooks: {
        beforeRequest: [
          async options => {
            if (!this.accessToken || isAfter(new Date(), this.accessTokenExpiresAt)) {
              debug('Access token is either undefined or expired')

              const authorization = await this.renewAccessToken()

              options.headers.authorization = authorization
            }
          }
        ],

        afterResponse: [
          async (response, retry) => {
            if (response.statusCode === 401) {
              debug('Unauthorized error encountered')

              await this.renewAccessToken()

              return retry({
                headers: this.got.defaults.options.headers
              })
            }

            return response
          }
        ]
      }
    })
  }

  async renewAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refreshToken was specified')
    }

    if (!this.clientSecret) {
      throw new Error('No clientSecret was specified')
    }

    debug('Renewing access token')

    const body = await got.post(TOKEN_ENDPOINT, {
      headers: {
        'user-agent': USER_AGENT
      },
      form: {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      }
    }).json()

    this.accessTokenExpiresAt = addSeconds(new Date(), body.expires_in)
    this.accessToken = body.access_token

    const authorization = `Bearer ${this.accessToken}`

    this.got = this.got.extend({
      headers: {
        authorization
      }
    })

    return authorization
  }

  // Profiles

  listProfiles() {
    return this.got.get('v2/profiles').json()
  }

  getProfile(profileId) {
    return this.got.get(`v2/profiles/${profileId}`).json()
  }

  registerProfile({countryCode}) {
    return this.got.put('v2/profiles/register', {
      json: {
        countryCode
      }
    }).json()
  }

  registerBrand({countryCode, brand}) {
    return this.got.put('v2/profiles/registerBrand', {
      json: {
        countryCode,
        brand
      }
    }).json()
  }
}

module.exports = Client
