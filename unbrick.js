#!/usr/bin/env node

/**
 * Developer: Shakir Abdo
 * Email: shicolare1@gmail.com
 * GitHub: shakir-abdo
 */

const usb = require('usb')
const {Command} = require('commander')
const chalk = require('chalk')
const program = new Command()

// WCH Link command function
function wchLinkCommand(device, command, replyLength = 0) {
  return new Promise((resolve, reject) => {
    try {
      const outEndpoint = device.interface(0).endpoint(0x01)
      const inEndpoint = device.interface(0).endpoint(0x81)

      outEndpoint.transfer(Buffer.from(command), (error) => {
        if (error) {
          console.error(chalk.red('Error sending command:'), error)
          return reject(error)
        }

        if (replyLength > 0) {
          inEndpoint.transfer(replyLength, (error, data) => {
            if (error) {
              console.error(chalk.red('Error receiving response:'), error)
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

async function main() {
  program.version('1.0.0').description('CLI tool to unbrick CH32V003 microcontrollers').parse(process.argv)

  try {
    // Find WCH-Link device
    const device = usb.findByIds(0x1a86, 0x8010)
    if (!device) {
      throw new Error('Could not find WCH-Link device')
    }

    console.log(chalk.green('Device found'))
    device.open()

    // Get the interface
    const interface = device.interface(0)

    // Detach kernel driver if necessary
    if (interface.isKernelDriverActive()) {
      try {
        interface.detachKernelDriver()
      } catch (e) {
        console.log(chalk.yellow('Kernel driver detach not necessary'))
      }
    }

    // Claim interface
    interface.claim()
    console.log(chalk.blue('starting'))

    // Initial setup commands
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x01])
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x01])
    await wchLinkCommand(device, [0x81, 0x0c, 0x20, 0x90, 0x01])
    await wchLinkCommand(device, [0x81, 0x0d, 0x01, 0x0f, 0x09])

    console.log(chalk.green('Device unbricked successfully'))

    // Cleanup
    interface.release(true, (err) => {
      if (err) console.error(chalk.red('Error releasing interface:'), err)
      device.close()
    })
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
  }
}

// Run the program
main().catch(console.error)
