#!/usr/bin/env node

/**
 * Developer: Shakir Abdo
 * Email: shicolare1@gmail.com
 * GitHub: shakir-abdo
 */

const usb = require('usb')
const {Command} = require('commander')
const program = new Command()

// Helper function to create delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// WCH Link command function
function wchLinkCommand(device, command, replyLength = 0) {
  return new Promise((resolve, reject) => {
    try {
      const outEndpoint = device.interface(0).endpoint(0x01)
      const inEndpoint = device.interface(0).endpoint(0x81)

      outEndpoint.transfer(Buffer.from(command), (error) => {
        if (error) {
          console.error('Error sending command:', error)
          return reject(error)
        }

        if (replyLength > 0) {
          inEndpoint.transfer(replyLength, (error, data) => {
            if (error) {
              console.error('Error receiving response:', error)
              return reject(error)
            }
            resolve(data)
          })
        } else {
          resolve()
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

// Control 3.3V function
async function Control3v3(device, isOn) {
  const command = isOn ? Buffer.from([0x81, 0x0d, 0x01, 0x09]) : Buffer.from([0x81, 0x0d, 0x01, 0x0a])

  await wchLinkCommand(device, command)
}

async function main() {
  program.version('1.0.0').description('CLI tool to unbrick CH32V003 devices').parse(process.argv)

  try {
    // Find WCH-Link device
    const device = usb.findByIds(0x1a86, 0x8010)
    if (!device) {
      throw new Error('Could not find WCH-Link device')
    }

    console.log('Device found')
    device.open()

    // Get the interface
    const interface = device.interface(0)

    // Detach kernel driver if necessary
    if (interface.isKernelDriverActive()) {
      try {
        interface.detachKernelDriver()
      } catch (e) {
        console.log('Kernel driver detach not necessary')
      }
    }

    // Claim interface
    interface.claim()

    console.log('Entering Unbrick Mode')
    await Control3v3(device, false)
    await sleep(500) // 500ms delay
    await Control3v3(device, true)
    await sleep(100) // 100ms delay

    console.log('Connection starting')

    // Initial setup commands
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x03], 1024)
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x01], 1024)

    // Configure debug module
    await wchLinkCommand(device, [0x81, 0x0c, 0x02, 0x05, 0x01], 1024)
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x02], 1024)

    // Erase chip
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x0f, 0x09], 1024)

    // Wait for operation to complete
    await sleep(500)

    console.log('Device unbricked successfully')

    // Cleanup
    interface.release(true, (err) => {
      if (err) console.error('Error releasing interface:', err)
      device.close()
    })
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Run the program
main().catch(console.error)
