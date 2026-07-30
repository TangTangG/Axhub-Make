import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'Basic/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['primary', 'secondary', 'text', 'link'] },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    children: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    type: 'primary',
    children: 'Button',
  },
};

export const Hover: Story = {
  args: {
    type: 'primary',
    children: 'Hover Me',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Active: Story = {
  args: {
    type: 'primary',
    children: 'Active',
  },
  parameters: {
    pseudo: { active: true },
  },
};

export const Focus: Story = {
  args: {
    type: 'primary',
    children: 'Focused',
  },
  parameters: {
    pseudo: { focus: true },
  },
};

export const Disabled: Story = {
  args: {
    type: 'primary',
    children: 'Disabled',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    type: 'primary',
    children: 'Loading',
    loading: true,
  },
};

export const SecondaryType: Story = {
  args: {
    type: 'secondary',
    children: 'Secondary Button',
  },
};

export const TextType: Story = {
  args: {
    type: 'text',
    children: 'Text Button',
  },
};

export const LinkType: Story = {
  args: {
    type: 'link',
    children: 'Link Button',
  },
};

export const LargeSize: Story = {
  args: {
    type: 'primary',
    size: 'large',
    children: 'Large',
  },
};

export const MediumSize: Story = {
  args: {
    type: 'primary',
    size: 'medium',
    children: 'Medium',
  },
};

export const SmallSize: Story = {
  args: {
    type: 'primary',
    size: 'small',
    children: 'Small',
  },
};

export const WithIcon: Story = {
  args: {
    type: 'primary',
    children: 'With Icon',
    icon: <span>+</span>,
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Button type="primary">Primary</Button>
      <Button type="primary" disabled>Disabled</Button>
      <Button type="primary" loading>Loading</Button>
      <Button type="secondary">Secondary</Button>
      <Button type="secondary" disabled>Disabled</Button>
      <Button type="text">Text</Button>
      <Button type="text" disabled>Disabled</Button>
      <Button type="link">Link</Button>
      <Button type="link" disabled>Disabled</Button>
    </div>
  ),
};
