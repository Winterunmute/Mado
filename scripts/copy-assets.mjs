import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const source = join(process.cwd(), 'assets')
const output = join(process.cwd(), 'dist', 'assets')
mkdirSync(output, { recursive: true })
for (const name of ['icon.png', 'icon-unread.png', 'icon-small.ico', 'icon-unread-small.ico']) {
  copyFileSync(join(source, name), join(output, name))
}
