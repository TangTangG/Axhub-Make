import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import Modal from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Layout/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    width: { control: 'text' },
    centered: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

const ModalDemo = (args: any) => {
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
        Open Modal
      </button>
      <Modal {...args} open={open} onClose={() => setOpen(false)}>
        {args.children}
      </Modal>
    </>
  );
};

export const Open: Story = {
  args: {
    open: true,
    title: 'Modal Title',
    children: 'This is the modal content. Press Escape or click the mask to close.',
  },
  render: (args) => <ModalDemo {...args} />,
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Modal Title',
    children: 'This modal starts closed. Click the button to open.',
  },
  render: (args) => <ModalDemo {...args} />,
};

export const Centered: Story = {
  args: {
    open: true,
    title: 'Centered Modal',
    centered: true,
    children: 'This modal is vertically centered.',
  },
  render: (args) => <ModalDemo {...args} />,
};

export const NotCentered: Story = {
  args: {
    open: true,
    title: 'Top Modal',
    centered: false,
    children: 'This modal is aligned to the top.',
  },
  render: (args) => <ModalDemo {...args} />,
};

export const WithFooter: Story = {
  args: {
    open: true,
    title: 'With Footer',
    children: 'Modal body content.',
    footer: (
      <>
        <button
          style={{
            padding: 'var(--spacing-xxs) var(--spacing-md)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-bg-primary)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          style={{
            padding: 'var(--spacing-xxs) var(--spacing-md)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </>
    ),
  },
  render: (args) => <ModalDemo {...args} />,
};

export const CustomWidth: Story = {
  args: {
    open: true,
    title: 'Wide Modal',
    width: 800,
    children: 'This modal has a custom width of 800px.',
  },
  render: (args) => <ModalDemo {...args} />,
};
