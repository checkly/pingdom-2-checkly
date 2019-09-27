#!/usr/bin/env node
const axios = require('axios')
const args = require('minimist')(process.argv.slice(2))

const couldNotConvert = []
const pingdomRegions = { latam: 'region: LATAM', apac: 'region:APAC', eu: 'region:EU',  na: 'region:NA' }

const defaultChecklyRegions = ['us-east-2', 'us-west-1', 'ca-central-1', 'eu-west-1', 'eu-north-1', 'eu-west-3']
const latamChecklyRegions = ['sa-east-1']
const apacChecklyRegions = ['ap-southeast-1', 'ap-northeast-1', 'ap-east-1', 'ap-southeast-2', 'ap-northeast-2', 'ap-south-1']
const naChecklyRegions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1']
const euChecklyRegions = ['eu-west-1', 'eu-west-2', 'eu-west-3',' eu-central-1', 'eu-north-1', 'me-south-1']

// Main loop
async function pingdomToCheckly(pingdomApiKey, checklyApiKey) {
  const pingdom = axios.create({
    baseURL: 'https://api.pingdom.com/api/3.1',
    timeout: 5000,
    headers: {'Authorization': `Bearer ${pingdomApiKey}`}
  })

  const checkly = axios.create({
    baseURL: 'https://api.checklyhq.com/v1',
    timeout: 5000,
    headers: {'Authorization': `Bearer ${checklyApiKey}`}
  })

  console.log('Fetching Pingdom Checks')
  const pingdomChecks = await pingdom.get('/checks')
  const nonPausedChecks = pingdomChecks.data.checks
    .filter(check => {
      return check.status !== 'paused'
    })

  console.log(`Found ${nonPausedChecks.length} total checks`)

  const checklyChecks = []
  for (const c of nonPausedChecks) {
    const pingdomCheck = await pingdom.get(`/checks/${c.id}`)

    // Only try to convert HTTP type checks, store all others and return early
    if (!pingdomCheck.data.check.type.http) {
      console.error(`Pingdom check ${pingdomCheck.data.check.name} is not a pingdom HTTP check`)
      couldNotConvert.push(pingdomCheck)
    } else {
      const checklyCheck = convertCheck(pingdomCheck.data.check)
      checklyChecks.push(checklyCheck)
    }
  }

  console.log(`Converted ${checklyChecks.length} Pingdom checks to Checkly checks`)
  console.log(`Could not converted ${couldNotConvert.length} Pingdom checks`)

  for (const check of couldNotConvert) {
    console.log(check.name)
  }

  for (const check of checklyChecks) {
    console.log(`Creating Checkly check "${check.name}"`)
    await checkly.post('/checks', check)
  }
}

function convertCheck (pingdomCheck) {
  console.log(`Converting Pingdom check "${pingdomCheck.name}" to Checkly format...`)

  // Create request
  const protocol = pingdomCheck.type.http.port === 443 ? 'https' : 'http'

  const request = {
    url: protocol + '://' +  pingdomCheck.hostname + pingdomCheck.type.http.url,
      method: 'GET'
  }

  // Create assertions
  request.assertions = createAssertions(pingdomCheck)

  // Create headers
  request.headers = createHeaders(pingdomCheck)

  // Create locations
  const locations = createLocations(pingdomCheck)

  // Create tags
  const tags = createTags(pingdomCheck)
  tags.push('pingdom')

  return {
    name: pingdomCheck.name,
    checkType: 'API',
    frequency: pingdomCheck.resolution,
    activated: true,
    request,
    locations,
    tags
  }
}

function createAssertions (pingdomCheck) {
  const assertions = [{
    source: 'STATUS_CODE',
    target: '200',
    property: '',
    comparison: 'EQUALS'
  }]


  if (pingdomCheck.type.http.shouldcontain) {
    assertions.push({
      source: 'TEXT_BODY',
      target: pingdomCheck.type.http.shouldcontain,
      property: '',
      comparison: 'CONTAINS'
    })
  }

  if (pingdomCheck.type.http.shouldnotcontain) {
    assertions.push({
      source: 'TEXT_BODY',
      target: pingdomCheck.type.http.shouldnotcontain,
      property: '',
      comparison: 'NOT_CONTAINS'
    })
  }
  return assertions
}

function createHeaders (pingdomCheck) {
  const headers = []
  if (Object.keys(pingdomCheck.type.http.requestheaders).length > 0) {
    for (const key of Object.keys(pingdomCheck.type.http.requestheaders)) {
     if (key.toLowerCase() !== 'user-agent') {
       headers.push({ key, value: pingdomCheck.type.http.requestheaders[key]})
     }
    }
  }
  return headers
}

function createLocations (pingdomCheck) {
  if (pingdomCheck.probe_filters.includes(pingdomRegions.latam)) return latamChecklyRegions
  if (pingdomCheck.probe_filters.includes(pingdomRegions.apac)) return apacChecklyRegions
  if (pingdomCheck.probe_filters.includes(pingdomRegions.eu)) return euChecklyRegions
  if (pingdomCheck.probe_filters.includes(pingdomRegions.na)) return naChecklyRegions
  return defaultChecklyRegions
}

function createTags (pingdomCheck) {
  return pingdomCheck.tags.map(tag => {
    return tag.name
  })
}

if (!args.pingdomApiKey) {
  console.log('please provide the --pingdomApiKey argument')
  process.exit(0)
}

if (!args.checklyApiKey) {
  console.log('please provide the --checklyApiKey argument')
  process.exit(0)
}

pingdomToCheckly(args.pingdomApiKey, args.checklyApiKey)
