const Client = require('../../lib/client')
const {sandbox} = require('../../lib/endpoints')

describe('lib.client', () => {
  it('should fail if no region is specified', () => {
    expect(
      () => new Client()
    ).toThrow('No region was specified')
  })

  it('should fail if an invalid region is specified', () => {
    expect(
      () => new Client({
        region: 'dudu'
      })
    ).toThrow('Unknown region: dudu')
  })

  it('should fail if clientId is not specified', () => {
    expect(
      () => new Client({
        region: 'eu'
      })
    ).toThrow('No clientId was specified')
  })

  it('should ignore the region if sandbox is specified', () => {
    const client = new Client({
      clientId: '1234',
      sandbox: true,
      region: 'eu'
    })

    expect(client.got.defaults.options.prefixUrl).toBe(`${sandbox}/`)
  })
})
