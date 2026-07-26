import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'Basic/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['primary', 'default', 'dashed', 'link'] },
    size: { control: 'select', options: ['large', 'middle', 'small'] },
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

export const DefaultType: Story = {
  args: {
    type: 'default',
    children: 'Default Button',
  },
};

export const DashedType: Story = {
  args: {
    type: 'dashed',
    children: 'Dashed Button',
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
      <Button type="primary">Default</Button>
      <Button type="primary" disabled>Disabled</Button>
      <Button type="primary" loading>Loading</Button>
      <Button type="default">Default</Button>
      <Button type="default" disabled>Disabled</Button>
      <Button type="dashed">Dashed</Button>
      <Button type="dashed" disabled>Disabled</Button>
      <Button type="link">Link</Button>
      <Button type="link" disabled>Disabled</Button>
    </div>
  ),
};
