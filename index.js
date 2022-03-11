// set up basic variables for app

const record = document.querySelector('.record')
const stop = document.querySelector('.stop')
const soundClips = document.querySelector('.sound-clips')
const canvas = document.querySelector('.visualizer')
const mainSection = document.querySelector('.main-controls')

// disable stop button while not recording

stop.disabled = true

// visualiser setup - create web audio api context and canvas

let audioCtx
const canvasCtx = canvas.getContext('2d')

let socket = null

const token =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6Ik5XSTBNemRsTXprdE5tSmtNaTAwTTJZMkxXSTNaamN0T1dVMU5URmxObVF4Wm1KaSIsInR5cCI6IkpXVCJ9.eyJhcHBsaWNhdGlvbl9pZCI6NDQ2NzIsImxpY2Vuc2Vfa2V5IjoiYjY1NjU3ZjgtMWU3Zi00NmEwLTljNzMtNDk1NGVjZDVhOGRiIiwidW5pcXVlX2tleSI6Ijg3OGM4YWY3LTQ4ZjItNDlmZC1iZjMzLTk5YmRkNzVmNjUwNSIsInByb2R1Y3RfaWQiOjUsImF1ZCI6ImFwaS1zZXJ2aWNlIiwic3ViIjoiY2VmMmRlM2MtOGU5YS00NTc5LTljNGItZWJlNThiMWVkOTRmIiwiZXhwIjoxNjc4NTIzNzUxLCJpc3MiOiJjb25zb2xlIiwiaWF0IjoxNjQ2OTg3NzUxfQ.LIvplVuKrkZNWKIulpGACd8HTJeyOzunP2JteM-4YI5NMjj99A8ooPPWk4QbK2E9exx9CEVffonr_c3okKcubG5LS05qlOkQ--lBg1DrZS8BQGw7ygj0uSj29RuaNUBO9A9Rw1rvVFUT2R243HyrwBbIQwCHrt6iovTVJ8KpFo97lqBwm8xa4HkGmeKudWMAHZ88h4WDb8JabGLfpF5vAw1BlKv-9vXtARX4iYFYJGmk_orqErKKlnPfXOuRwmecHjJcFcDjxueDsSP4URxyUoJNLc_6KfcM_zfW7ThgLr7Ny9I6KIkQ23w8xXAdmzcKZeGH4N118r3NSxY0JMT7LQ'

//main block for doing the audio recording

if (navigator.mediaDevices.getUserMedia) {
  const constraints = { audio: true }
  let chunks = []

  let onSuccess = function (stream) {
    const mediaRecorder = new MediaRecorder(stream)

    visualize(stream)

    record.onclick = function () {
      socket = new WebSocket('wss://s-api.prosa.ai/v2/speech/stt')

      socket.addEventListener('message', (event) => {
        console.log(event)
      })

      socket.addEventListener('close', (event) => {
        console.log(event)
      })

      socket.addEventListener('open', (event) => {
        socket.send(
          JSON.stringify({
            token,
          })
        )

        socket.send(
          JSON.stringify({
            label: null,
            model: 'stt-general-online',
            audio: {
              format: 'wav',
              channels: 1,
              sample_rate: 16000,
            },
            include_filler: false,
            include_partial: true,
          })
        )

        startRecording()
      })
    }

    mediaRecorder.ondataavailable = async ({ data }) => {
      if (data.size) {
        const buffer = await data.arrayBuffer()
        if (socket) socket.send(buffer)
        chunks.push(data)
      }
    }

    const startRecording = () => {
      mediaRecorder.start(1000) // 1000 ms interval ondataavailable
      console.log(mediaRecorder.state)
      console.log('recorder started')
      record.style.background = 'red'

      stop.disabled = false
      record.disabled = true
    }

    stop.onclick = function () {
      mediaRecorder.stop()
      console.log(mediaRecorder.state)
      console.log('recorder stopped')
      record.style.background = ''
      record.style.color = ''
      // mediaRecorder.requestData();

      stop.disabled = true
      record.disabled = false
    }

    mediaRecorder.onstop = function (e) {
      console.log('data available after MediaRecorder.stop() called.')

      const clipName = prompt(
        'Enter a name for your sound clip?',
        'My unnamed clip'
      )

      const clipContainer = document.createElement('article')
      const clipLabel = document.createElement('p')
      const audio = document.createElement('audio')
      const deleteButton = document.createElement('button')

      clipContainer.classList.add('clip')
      audio.setAttribute('controls', '')
      deleteButton.textContent = 'Delete'
      deleteButton.className = 'delete'

      if (clipName === null) {
        clipLabel.textContent = 'My unnamed clip'
      } else {
        clipLabel.textContent = clipName
      }

      clipContainer.appendChild(audio)
      clipContainer.appendChild(clipLabel)
      clipContainer.appendChild(deleteButton)
      soundClips.appendChild(clipContainer)

      audio.controls = true
      const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' })
      chunks = []
      const audioURL = window.URL.createObjectURL(blob)
      audio.src = audioURL
      console.log('recorder stopped')

      deleteButton.onclick = function (e) {
        let evtTgt = e.target
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode)
      }

      clipLabel.onclick = function () {
        const existingName = clipLabel.textContent
        const newClipName = prompt('Enter a new name for your sound clip?')
        if (newClipName === null) {
          clipLabel.textContent = existingName
        } else {
          clipLabel.textContent = newClipName
        }
      }
    }
  }

  let onError = function (err) {
    console.log('The following error occured: ' + err)
  }

  navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError)
} else {
  console.log('getUserMedia not supported on your browser!')
}

function visualize(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }

  const source = audioCtx.createMediaStreamSource(stream)

  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 2048
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  source.connect(analyser)
  //analyser.connect(audioCtx.destination);

  draw()

  function draw() {
    const WIDTH = canvas.width
    const HEIGHT = canvas.height

    requestAnimationFrame(draw)

    analyser.getByteTimeDomainData(dataArray)

    canvasCtx.fillStyle = 'rgb(200, 200, 200)'
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

    canvasCtx.lineWidth = 2
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)'

    canvasCtx.beginPath()

    let sliceWidth = (WIDTH * 1.0) / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0
      let y = (v * HEIGHT) / 2

      if (i === 0) {
        canvasCtx.moveTo(x, y)
      } else {
        canvasCtx.lineTo(x, y)
      }

      x += sliceWidth
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2)
    canvasCtx.stroke()
  }
}

window.onresize = function () {
  canvas.width = mainSection.offsetWidth
}

window.onresize()
