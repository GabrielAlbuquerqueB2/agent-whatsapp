import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { google } from 'googleapis';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);
  private readonly oauth2Client;

  constructor(private readonly configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Inicia autenticação OAuth com Google' })
  authorize(@Res() res: Response) {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Força a exibição do consentimento para obter refresh_token
    });

    this.logger.log('Redirecionando para autenticação Google...');
    res.redirect(authUrl);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Callback da autenticação OAuth' })
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).send(`
        <html>
          <head><title>Erro - PSI Agenda</title></head>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1 style="color: #ef4444;">❌ Erro na Autenticação</h1>
            <p>Código de autorização não recebido.</p>
            <a href="/auth/google">Tentar novamente</a>
          </body>
        </html>
      `);
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.logger.log('✅ Tokens obtidos com sucesso!');
      this.logger.log(`Access Token: ${tokens.access_token?.substring(0, 20)}...`);
      this.logger.log(`Refresh Token: ${tokens.refresh_token}`);

      // Retorna página HTML com o refresh token
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Sucesso - PSI Agenda</title>
            <style>
              body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; background: #f1f5f9; }
              .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              h1 { color: #22c55e; }
              .token-box { background: #1e293b; color: #22c55e; padding: 20px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 20px 0; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; }
              .instructions { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; }
              code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
              a { color: #6366f1; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Autenticação Google Concluída!</h1>
              
              <p>Sua conta Google foi conectada com sucesso ao PSI Agenda.</p>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong> Copie o Refresh Token abaixo e adicione no seu arquivo <code>.env</code>
              </div>
              
              <h3>Refresh Token:</h3>
              <div class="token-box" id="refresh-token">
                ${tokens.refresh_token || 'Não foi possível obter o refresh token. Tente novamente com prompt=consent.'}
              </div>
              
              <button onclick="navigator.clipboard.writeText('${tokens.refresh_token || ''}'); alert('Copiado!');" 
                      style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
                📋 Copiar Refresh Token
              </button>
              
              <div class="instructions">
                <strong>📝 Próximos passos:</strong>
                <ol>
                  <li>Abra o arquivo <code>.env</code></li>
                  <li>Substitua <code>GOOGLE_REFRESH_TOKEN=seu_refresh_token</code> pelo token acima</li>
                  <li>Reinicie a aplicação</li>
                </ol>
              </div>
              
              <p><a href="/dashboard">← Voltar ao Dashboard</a></p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      this.logger.error('Erro ao obter tokens:', error);
      return res.status(500).send(`
        <html>
          <head><title>Erro - PSI Agenda</title></head>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1 style="color: #ef4444;">❌ Erro na Autenticação</h1>
            <p>${error.message}</p>
            <a href="/auth/google">Tentar novamente</a>
          </body>
        </html>
      `);
    }
  }
}
