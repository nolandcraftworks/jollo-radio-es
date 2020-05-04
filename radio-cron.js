const cron = require('node-cron')
const fs = require('fs')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

let delfile = function(testFolder, file) {
  try {
    fs.unlinkSync(`${testFolder}${file}`)
    console.log(`removed ${file}`)
    return
  }
  catch(e) {
    console.log(`couldnt delete ${testFolder}${file}`)
    return
  }  
}

function purgeold() {
  console.log("purging old")
  const testFolder = './tracks/'
  fs.readdir(testFolder, (err, files) => {
    files.forEach(file => {
      let split = Number(file.split("-")[0])
      if (isNaN(split)) {
        delfile(testFolder, file)
      }
      else {
        let now = (+ new Date())
        let diff = ~~((now - split) / 1000 / 60 / 60)
        if (diff > 16) {
          delfile(testFolder, file)
        }
      }
    })
  })
}

async function updateyt() {
  try {
    let string = `sudo youtube-dl -U  && youtube-dl --rm-cache-dir`
    const { stdout, stderr } = await exec(string)  
  }
  catch(e) {
    console.error(e)
  }
}

let job = cron.schedule('0 */8 * * *', () =>  {
  purgeold()
  updateyt()
})

purgeold()
updateyt()
