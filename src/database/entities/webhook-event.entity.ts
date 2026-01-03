import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  source: string; // 'asaas', 'whatsapp'

  @Index({ unique: true })
  @Column()
  event_id: string; // ID único do evento para idempotência

  @Column()
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ default: false })
  processed: boolean;

  @Column({ nullable: true })
  error_message: string;

  @Column({ default: 0 })
  retry_count: number;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;

  @CreateDateColumn()
  received_at: Date;
}
