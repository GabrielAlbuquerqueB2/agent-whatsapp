import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class WhatsAppMessageText {
  @ApiProperty()
  @IsString()
  body: string;
}

class WhatsAppButtonReply {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;
}

class WhatsAppListReply {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;
}

class WhatsAppInteractive {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppButtonReply)
  button_reply?: WhatsAppButtonReply;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppListReply)
  list_reply?: WhatsAppListReply;
}

class WhatsAppMessage {
  @ApiProperty()
  @IsString()
  from: string;

  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  timestamp: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMessageText)
  text?: WhatsAppMessageText;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppInteractive)
  interactive?: WhatsAppInteractive;
}

class WhatsAppContact {
  @ApiProperty()
  @IsString()
  wa_id: string;

  @ApiProperty()
  profile: {
    name: string;
  };
}

class WhatsAppValue {
  @ApiProperty()
  @IsString()
  messaging_product: string;

  @ApiProperty()
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppContact)
  contacts?: WhatsAppContact[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessage)
  messages?: WhatsAppMessage[];

  @ApiProperty({ required: false })
  @IsOptional()
  statuses?: any[];
}

class WhatsAppChange {
  @ApiProperty()
  @IsString()
  field: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => WhatsAppValue)
  value: WhatsAppValue;
}

class WhatsAppEntry {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChange)
  changes: WhatsAppChange[];
}

export class WhatsAppWebhookDto {
  @ApiProperty()
  @IsString()
  object: string;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntry)
  entry: WhatsAppEntry[];
}

export class WhatsAppVerifyDto {
  @ApiProperty()
  @IsString()
  'hub.mode': string;

  @ApiProperty()
  @IsString()
  'hub.verify_token': string;

  @ApiProperty()
  @IsString()
  'hub.challenge': string;
}
