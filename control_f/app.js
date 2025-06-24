import express from 'express'
import expressWs from 'express-ws'

import router from './routers/index.js'

const app = express()
expressWs(app)

app.ws('*', router)

export default app