import { CommonModule } from '@angular/common';
import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Naipe } from '../models/schedule.models';

export interface MemberFormValue {
  name: string;
  naipe: Naipe;
  email: string;
}

@Component({
  selector: 'app-member-form-row',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './member-form-row.component.html',
  styleUrl: './member-form-row.component.scss',
  host: {
    '[class.add-mode]': "mode() === 'add'"
  }
})
export class MemberFormRowComponent {
  readonly mode = input<'add' | 'edit'>('add');
  readonly initialValue = input<MemberFormValue>({
    name: '',
    naipe: 'Vocalista',
    email: ''
  });

  readonly submitForm = output<MemberFormValue>();
  readonly cancelEdit = output<void>();

  readonly name = signal('');
  readonly naipe = signal<Naipe>('Vocalista');
  readonly email = signal('');
  readonly errorMessage = signal('');

  private readonly emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  constructor() {
    effect(() => {
      const initialValue = this.initialValue();
      this.name.set(initialValue.name);
      this.naipe.set(initialValue.naipe);
      this.email.set(this.maskEmail(initialValue.email));
      this.errorMessage.set('');
    });
  }

  onEmailChange(value: string) {
    this.email.set(this.maskEmail(value));
  }

  submit() {
    this.errorMessage.set('');

    const name = this.name().trim();
    const email = this.maskEmail(this.email());

    if (!name) {
      this.errorMessage.set('Nome é obrigatório.');
      return;
    }

    if (email && !this.emailRegex.test(email)) {
      this.errorMessage.set('Email inválido. Usa o formato nome@dominio.pt.');
      return;
    }

    this.submitForm.emit({
      name,
      naipe: this.naipe(),
      email
    });

    if (this.mode() === 'add') {
      this.name.set('');
      this.naipe.set('Vocalista');
      this.email.set('');
    }
  }

  cancel() {
    this.cancelEdit.emit();
  }

  private maskEmail(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
  }
}
