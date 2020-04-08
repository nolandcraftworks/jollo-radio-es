module.exports = {
  wordIsAValidMusicLink: function(word) {
  
    function matchYoutubeUrl(url) {
      var p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/
      if (url.match(p)){
        return true
      }
      return false
    }  
    function matchMixcloudUrl(url) {
      var p = /https?\:\/\/www\.mixcloud\.com\/[a-zA-Z0-9\-\_]+\/[a-zA-Z0-9\-\_]+\/?/
      if (url.match(p)){
        return true
      }
      return false
    }  
    function matchSoundcloudUrl(url) {
      var p = /((https:\/\/)|(http:\/\/)|(www.)|(m\.)|(\s))+(soundcloud.com\/)+[a-zA-Z0-9\_\-\.]+(\/)+[a-zA-Z0-9\_\-\.]+/
      if (url.match(p)){
        return true
      }
      return false
    }  
    function matchBandcampUrl(url) {
      var p = /https?\:\/\/([a-zA-Z0-9-]+)\.bandcamp\.com\/track\/[a-zA-Z0-9-\_]+/
      if (url.match(p)){
        return true
      }
      return false
    }  
    function matchAudioUrl(url) {
      var p = /(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?\.(mp3|flac|wav)/i
      if (url.match(p)){
        return true
      }
      return false
    }  
    
    let valid = false
    
    if (matchYoutubeUrl(word)) {
      valid = true
    }
    else if (matchSoundcloudUrl(word)) {
      valid = true
    }
    else if (matchMixcloudUrl(word)) {
      valid = true
    }
    else if (matchBandcampUrl(word)) {
      valid = true
    }
    else if (matchAudioUrl(word)) {
      valid = true
    }

    return valid
  }
}