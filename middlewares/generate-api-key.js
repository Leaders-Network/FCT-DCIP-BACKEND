require('dotenv').config()
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')


const generateApiKey = () => {
  let base36string = [...Array(30)]
          .map((e) => ((Math.random() * 36) | 0).toString(36))
          .join('')

  const algorithm = 'sha512'
  const secret = process.env.JWT_SECRET
  const newApiKey = crypto.createHmac(algorithm, secret).update(base36string).digest('hex')

  const envFilePath = path.join(__dirname, '..', '.env')
  fs.readFile(envFilePath, 'utf8', (error, data) => {
      if(error){ console.log(error) }

      const content = data.split('\n')
                .map((line) => line.startsWith('API_KEY') ? `API_KEY = ${newApiKey}` : line)
                .join('\n')

      fs.writeFile(envFilePath, content, 'utf8', (error) => {
          if(error){ console.log(error) }
          else{ console.log("API-Key Updated Successfully !") }
      })
  })
}

const validateApiKey = (req, res, next) => {
  
  const appApiKey = req.headers.apikey

  if (!appApiKey) {
    return res.status(StatusCodes.UNAUTHORIZED).json('No ApiKey Provided !')
  }
  
  if (appApiKey === process.env.API_KEY){
    return next()
  }
  else{
    return res.status(StatusCodes.UNAUTHORIZED).json('Invalid Api-Key !')
  }
}

module.exports =  validateApiKey 