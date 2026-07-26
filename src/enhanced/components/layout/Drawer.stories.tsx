import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import Drawer from './Drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Layout/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    width: { control: 'text' },
    placement: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

const DrawerDemo = (args: any) => {
  const [open, setOpen] = useState(args.open ?? false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-md)',
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        Open Drawer
      </button>
      <Drawer {...args} open={open} onClose={() => setOpen(false)}>
        {args.children}
      </Drawer>
    </>
  );
};

export const Open: Story = {
  args: {
    open: true,
    title: 'Drawer Title',
    children: 'This is the drawer content. Press Escape or click the mask to close.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Drawer Title',
    children: 'This drawer starts closed. Click the button to open.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const PlacementRight: Story = {
  args: {
    open: true,
    title: 'Right Drawer',
    placement: 'right',
    children: 'Drawer on the right side.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const PlacementLeft: Story = {
  args: {
    open: true,
    title: 'Left Drawer',
    placement: 'left',
    children: 'Drawer on the left side.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const PlacementTop: Story = {
  args: {
    open: true,
    title: 'Top Drawer',
    placement: 'top',
    children: 'Drawer from the top.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const PlacementBottom: Story = {
  args: {
    open: true,
    title: 'Bottom Drawer',
    placement: 'bottom',
    children: 'Drawer from the bottom.',
  },
  render: (args) => <DrawerDemo {...args} />,
};

export const CustomWidth: Story = {
  args: {
    open: true,
    title: 'Wide Drawer',
    width: 600,
    children: 'This drawer has a custom width of 600px.',
  },
  render: (args) => <DrawerDemo {...args} />,
};
