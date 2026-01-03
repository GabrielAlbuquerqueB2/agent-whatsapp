import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { AppLogger } from '../../common/logger/app-logger.service';

export interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  attendeeEmail?: string;
  attendeeName?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

@Injectable()
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.initializeCalendar();
  }

  private initializeCalendar() {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    oauth2Client.setCredentials({
      refresh_token: this.configService.get('GOOGLE_REFRESH_TOKEN'),
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.calendarId = this.configService.get('GOOGLE_CALENDAR_ID') || 'primary';
  }

  /**
   * Cria um evento no calendário
   */
  async createEvent(event: CalendarEvent): Promise<calendar_v3.Schema$Event> {
    try {
      const calendarEvent: calendar_v3.Schema$Event = {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.startDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: event.endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      if (event.attendeeEmail) {
        calendarEvent.attendees = [
          {
            email: event.attendeeEmail,
            displayName: event.attendeeName,
          },
        ];
      }

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: calendarEvent,
        sendUpdates: 'all',
      });

      this.logger.log(
        `Evento criado no Google Calendar: ${response.data.id}`,
        'GoogleCalendarService',
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao criar evento no Google Calendar: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      throw error;
    }
  }

  /**
   * Atualiza um evento existente
   */
  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
  ): Promise<calendar_v3.Schema$Event> {
    try {
      const updateData: calendar_v3.Schema$Event = {};

      if (event.summary) updateData.summary = event.summary;
      if (event.description) updateData.description = event.description;
      if (event.startDateTime) {
        updateData.start = {
          dateTime: event.startDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }
      if (event.endDateTime) {
        updateData.end = {
          dateTime: event.endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }

      const response = await this.calendar.events.patch({
        calendarId: this.calendarId,
        eventId,
        requestBody: updateData,
        sendUpdates: 'all',
      });

      this.logger.log(
        `Evento atualizado no Google Calendar: ${eventId}`,
        'GoogleCalendarService',
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar evento no Google Calendar: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      throw error;
    }
  }

  /**
   * Cancela/deleta um evento
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all',
      });

      this.logger.log(
        `Evento deletado do Google Calendar: ${eventId}`,
        'GoogleCalendarService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao deletar evento do Google Calendar: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      throw error;
    }
  }

  /**
   * Busca eventos em um período
   */
  async getEvents(startDate: Date, endDate: Date): Promise<calendar_v3.Schema$Event[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      this.logger.error(
        `Erro ao buscar eventos do Google Calendar: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      throw error;
    }
  }

  /**
   * Verifica horários disponíveis em uma data
   */
  async getAvailableSlots(
    date: Date,
    startHour: string,
    endHour: string,
    slotDurationMinutes: number,
  ): Promise<TimeSlot[]> {
    try {
      // Define início e fim do dia
      const startOfDay = new Date(date);
      const [startH, startM] = startHour.split(':').map(Number);
      startOfDay.setHours(startH, startM, 0, 0);

      const endOfDay = new Date(date);
      const [endH, endM] = endHour.split(':').map(Number);
      endOfDay.setHours(endH, endM, 0, 0);

      // Busca eventos do dia
      const events = await this.getEvents(startOfDay, endOfDay);

      // Gera todos os slots possíveis
      const allSlots: TimeSlot[] = [];
      let currentSlotStart = new Date(startOfDay);

      while (currentSlotStart.getTime() + slotDurationMinutes * 60000 <= endOfDay.getTime()) {
        const slotEnd = new Date(currentSlotStart.getTime() + slotDurationMinutes * 60000);
        allSlots.push({ start: new Date(currentSlotStart), end: slotEnd });
        currentSlotStart = new Date(slotEnd);
      }

      // Filtra slots ocupados
      const availableSlots = allSlots.filter((slot) => {
        return !events.some((event) => {
          const eventStartStr = event.start?.dateTime || event.start?.date || '';
          const eventEndStr = event.end?.dateTime || event.end?.date || '';
          const eventStart = new Date(eventStartStr);
          const eventEnd = new Date(eventEndStr);

          // Verifica se há sobreposição
          return slot.start < eventEnd && slot.end > eventStart;
        });
      });

      return availableSlots;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar horários disponíveis: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      throw error;
    }
  }

  /**
   * Verifica se um horário específico está disponível
   */
  async isSlotAvailable(
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<boolean> {
    try {
      const events = await this.getEvents(startDateTime, endDateTime);
      return events.length === 0;
    } catch (error) {
      this.logger.error(
        `Erro ao verificar disponibilidade: ${error.message}`,
        error.stack,
        'GoogleCalendarService',
      );
      return false;
    }
  }
}
