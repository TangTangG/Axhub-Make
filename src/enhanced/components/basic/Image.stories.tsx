import type { Meta, StoryObj } from '@storybook/react';
import Image from './Image';

const meta: Meta<typeof Image> = {
  title: 'Basic/Image',
  component: Image,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    width: { control: 'text' },
    height: { control: 'text' },
    fit: { control: 'select', options: ['cover', 'contain', 'fill', 'none'] },
    fallback: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Image>;

export const Default: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Placeholder image',
    width: 400,
    height: 300,
  },
};

export const Loading: Story = {
  args: {
    src: 'https://httpbin.org/delay/5',
    alt: 'Loading image',
    width: 400,
    height: 300,
  },
};

export const Error: Story = {
  args: {
    src: 'https://invalid-url.example/404',
    alt: 'Broken image',
    width: 400,
    height: 300,
  },
};

export const ErrorWithFallback: Story = {
  args: {
    src: 'https://invalid-url.example/404',
    alt: 'Broken image with fallback',
    width: 400,
    height: 300,
    fallback: 'https://picsum.photos/400/300?grayscale',
  },
};

export const Contain: Story = {
  args: {
    src: 'https://picsum.photos/800/400',
    alt: 'Contain fit image',
    width: 300,
    height: 300,
    fit: 'contain',
  },
};

export const Fill: Story = {
  args: {
    src: 'https://picsum.photos/200/200',
    alt: 'Fill fit image',
    width: 400,
    height: 300,
    fit: 'fill',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px' }}>
      <div>
        <p style={{ marginBottom: 8 }}>Default</p>
        <Image src="https://picsum.photos/200/150" alt="Default" width={200} height={150} />
      </div>
      <div>
        <p style={{ marginBottom: 8 }}>Loading</p>
        <Image src="https://httpbin.org/delay/10" alt="Loading" width={200} height={150} />
      </div>
      <div>
        <p style={{ marginBottom: 8 }}>Error</p>
        <Image src="https://invalid.example/img" alt="Error" width={200} height={150} />
      </div>
    </div>
  ),
};
