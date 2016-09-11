import 'babel-polyfill'
import fetch from 'node-fetch'
import 'colors'
import { parse } from 'ini'
import { readFileSync } from 'fs'
import { findAPortNotInUse } from 'portscanner'
import mysql from 'mysql'
import _ from 'lodash'
import promisify from 'promisify-node'
import Koa from 'koa'
import http from 'http'
import Primus from 'primus'
import bodyParser from 'koa-bodyparser'
import Router from 'koa-router'
import { Mailgun } from 'mailgun'
const router = Router()
const app = new Koa()
const server = require('http').Server(app.callback())
const mg = new Mailgun(/* ENTER YOUR MAILGUN API KEY HERE AS A STRING */)
let pastSentEmail
const getAvailibility = async () => {
  process.stdout.write('!')
  let contact = false
  const resp = await fetch('https://reserve.cdn-apple.com/US/en_US/reserve/iPhone/availability.json')
  const respJson = await resp.json()
  const stores = { // THIS IS THERE YOU PUT THE LIST OF STORES YOU WANT CHECKED. USE THE STORES.JSON TO FIND THE STORE IDS
    Carlsbad: 'R294',
    'North County': 'R285',
    UTC: 'R082',
    'Fashion Valley': 'R040',
    'Chula Vista': 'R213',
  }
  const isAvailibleJson = model => {
    const resp = {}
    _.each(stores, (storeId, storeName) => {
      const noneOrAll = _.get(respJson, [storeId, model])
      const isNone = noneOrAll === 'NONE'
      const isAll = noneOrAll === 'ALL'
      if (isAll) {
        resp[storeName] = true
        contact = true
      }
    })
    return resp
  }
  const availability = { // THIS IS THERE YOU PUT THE LIST OF PHONES YOU WANT CHECKED. USE THE PRODUCT-OFFERING.JSON TO FIND THE PHONE MODELS
    'T-Mobile': {
      'iPhone 7': {
        'Jet Black': {
          '125GB': isAvailibleJson('MNA52LL/A'),
          '256GB': isAvailibleJson('MNAA2LL/A'),
        }
      },
      'iPhone 7 Plus': {
        'Jet Black': {
          '125GB': isAvailibleJson('MN5L2LL/A'),
          '256GB': isAvailibleJson('MN5R2LL/A'),
        }
      }
    }
  }
  const body = {
    contact,
    availability,
    link: 'https://reserve.cdn-apple.com/US/en_US/reserve/iPhone/availability?channel=1&sourceID=email&rv=0&path=&iPP=U&appleCare=Y',
  }
  if (contact) process.stdout.write('.')
  if (contact && JSON.stringify(pastSentEmail) !== JSON.stringify(body)) {
    console.log(availability)
    pastSentEmail = body
    mg.sendText(/* PUT YOUR SENDER ADDRESS HERE */, [/* PUT YOUR "SEND TO" EMAIL HERE */], 'Good news! An iPhone reservation is availible!', JSON.stringify(body, null, 2))
  }
  return body
}
setInterval(getAvailibility, 10000)
const entry = (async (f) => {
  findAPortNotInUse(1337, 1337, '127.0.0.1', (err, port) => {
    if (err) throw err
    router
      .get('/getAvailibility', async (ctx, next) => {
        try {
          await next()
          ctx.body = await getAvailibility()
        } catch (err) {
          ctx.body = err
        }
      })
    app
      .use(bodyParser())
      .use(router.routes())
      .use(router.allowedMethods())
      .use((ctx, next) => {
        console.log(ctx.url)
        return next()
      })
    server.listen(port)
    console.log('Listening to port', port)
  })
})()
