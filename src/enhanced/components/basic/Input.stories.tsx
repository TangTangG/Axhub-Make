import type { Meta, StoryObj } from '@storybook/react';
import Input from './Input';

const meta: Meta<typeof Input> = {
  title: 'Basic/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['text', 'password', 'email', 'number', 'tel', 'url'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const Hover: Story = {
  args: {
    placeholder: 'Hover over me',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus: Story = {
  args: {
    placeholder: 'Focused input',
  },
  parameters: {
    pseudo: { focus: true },
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const Error: Story = {
  args: {
    placeholder: 'Error input',
    error: true,
    errorMessage: 'This field is required',
  },
};

export const Placeholder: Story = {
  args: {
    placeholder: 'Placeholder text',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Input value',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px' }}>
      <Input placeholder="Default" />
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Error state" error errorMessage="Something went wrong" />
      <Input placeholder="Password" type="password" />
      <Input value="Controlled value" />
    </div>
  ),
};
