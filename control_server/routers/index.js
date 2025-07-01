import { APIController, VRController }  from '../controllers/index.js'

const routes = [
  {
    regex: /\/api\/.websocket$/,
    controller: APIController
  },
  {
    regex: /\/.websocket$/,
    controller: VRController
  }
]

const router = (ws, req) => {

    // console.log(`Request from ${req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress}`)
    // console.log(`Headers: ${JSON.stringify(req.headers)}`)

    // console.log('request url', req.url);

    routes.forEach((route) => {

      if (route.regex.test(req.url)) {
        // console.log(req.url)
        route.controller(ws, req)
      }
    })
}

export default router
