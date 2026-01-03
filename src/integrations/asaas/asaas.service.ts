import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { AppLogger } from '../../common/logger/app-logger.service';
import { generateIdempotencyKey } from '../../common/utils/helpers';

export interface AsaasCustomer {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasPayment {
  customer: string; // ID do cliente Asaas
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  postalService?: boolean;
}

export interface AsaasPaymentResponse {
  id: string;
  dateCreated: string;
  customer: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
}

@Injectable()
export class AsaasService {
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    const apiUrl = this.configService.get<string>('ASAAS_API_URL');
    const apiKey = this.configService.get<string>('ASAAS_API_KEY');

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // ==========================================
  // CLIENTES
  // ==========================================

  /**
   * Busca cliente pelo CPF/CNPJ
   */
  async findCustomerByCpfCnpj(cpfCnpj: string): Promise<any | null> {
    try {
      const response = await this.client.get('/customers', {
        params: { cpfCnpj: cpfCnpj.replace(/\D/g, '') },
      });

      const customers = response.data.data;
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar cliente por CPF: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return null;
    }
  }

  /**
   * Busca cliente pelo ID
   */
  async getCustomerById(customerId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar cliente: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return null;
    }
  }

  /**
   * Cria um novo cliente no Asaas
   * Retorna cliente existente se já houver um com mesmo CPF
   */
  async createCustomer(customer: AsaasCustomer): Promise<any> {
    try {
      // Verifica se já existe
      const existingCustomer = await this.findCustomerByCpfCnpj(customer.cpfCnpj);
      if (existingCustomer) {
        this.logger.log(
          `Cliente já existe no Asaas: ${existingCustomer.id}`,
          'AsaasService',
        );
        return existingCustomer;
      }

      const response = await this.client.post('/customers', {
        ...customer,
        cpfCnpj: customer.cpfCnpj.replace(/\D/g, ''),
      });

      this.logger.log(
        `Cliente criado no Asaas: ${response.data.id}`,
        'AsaasService',
      );

      this.logger.auditFinanceiro('CLIENTE_ASAAS_CRIADO', {
        asaas_customer_id: response.data.id,
        cpf: customer.cpfCnpj,
        nome: customer.name,
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao criar cliente no Asaas: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      throw error;
    }
  }

  /**
   * Atualiza dados de um cliente
   */
  async updateCustomer(customerId: string, data: Partial<AsaasCustomer>): Promise<any> {
    try {
      const response = await this.client.put(`/customers/${customerId}`, data);
      this.logger.log(
        `Cliente atualizado no Asaas: ${customerId}`,
        'AsaasService',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar cliente: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      throw error;
    }
  }

  // ==========================================
  // COBRANÇAS
  // ==========================================

  /**
   * Cria uma nova cobrança
   */
  async createPayment(payment: AsaasPayment): Promise<AsaasPaymentResponse> {
    try {
      const idempotencyKey = generateIdempotencyKey('pay');

      const response = await this.client.post('/payments', payment, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      this.logger.log(
        `Cobrança criada no Asaas: ${response.data.id}`,
        'AsaasService',
      );

      this.logger.auditFinanceiro('COBRANCA_CRIADA', {
        asaas_payment_id: response.data.id,
        customer_id: payment.customer,
        valor: payment.value,
        tipo: payment.billingType,
        vencimento: payment.dueDate,
        idempotency_key: idempotencyKey,
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao criar cobrança: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      throw error;
    }
  }

  /**
   * Busca uma cobrança pelo ID
   */
  async getPaymentById(paymentId: string): Promise<AsaasPaymentResponse | null> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar cobrança: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return null;
    }
  }

  /**
   * Busca cobranças de um cliente
   */
  async getPaymentsByCustomer(customerId: string): Promise<AsaasPaymentResponse[]> {
    try {
      const response = await this.client.get('/payments', {
        params: { customer: customerId },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar cobranças do cliente: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return [];
    }
  }

  /**
   * Cancela uma cobrança
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      await this.client.delete(`/payments/${paymentId}`);
      
      this.logger.log(`Cobrança cancelada: ${paymentId}`, 'AsaasService');
      
      this.logger.auditFinanceiro('COBRANCA_CANCELADA', {
        asaas_payment_id: paymentId,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao cancelar cobrança: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return false;
    }
  }

  /**
   * Obtém QR Code PIX de uma cobrança
   */
  async getPixQrCode(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/payments/${paymentId}/pixQrCode`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao obter QR Code PIX: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return null;
    }
  }

  /**
   * Obtém linha digitável do boleto
   */
  async getBoletoIdentificationField(paymentId: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/payments/${paymentId}/identificationField`);
      return response.data.identificationField;
    } catch (error) {
      this.logger.error(
        `Erro ao obter linha digitável: ${error.message}`,
        error.stack,
        'AsaasService',
      );
      return null;
    }
  }

  // ==========================================
  // WEBHOOKS
  // ==========================================

  /**
   * Valida assinatura do webhook Asaas
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    const webhookToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN');
    
    // Asaas envia o token no header para validação
    return signature === webhookToken;
  }
}
