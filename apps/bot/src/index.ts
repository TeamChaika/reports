import { Bot } from 'grammy'

const token = process.env['TELEGRAM_BOT_TOKEN']
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required')

const bot = new Bot(token)

bot.command('start', (ctx) => ctx.reply('Добро пожаловать! Используйте /report для сдачи отчёта.'))
bot.command('report', (ctx) => ctx.reply('Wizard в разработке...'))

bot.catch((err) => {
  console.error('Bot error:', err)
})

bot.start()
console.log('Bot started')
