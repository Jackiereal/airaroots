import { channelRepository } from '../repositories/channel.repository';
import { NotFoundError, ConflictError } from '../../../shared/errors/domain-errors';
import type { ChannelConnection, CreateChannelConnectionInput, UpdateChannelConnectionInput } from '../types';

export const channelConnectionService = {
  async create(
    organizationId: string,
    input: CreateChannelConnectionInput,
    createdBy: string,
  ): Promise<ChannelConnection> {
    const existing = await channelRepository.findByProperty(input.propertyId);
    const duplicate = existing.find(c => c.channel === input.channel);
    if (duplicate) {
      throw new ConflictError(
        `Property already has a ${input.channel} connection. Update it instead.`,
        [duplicate.id],
      );
    }
    return channelRepository.create(organizationId, input, createdBy);
  },

  async update(
    id: string,
    organizationId: string,
    input: UpdateChannelConnectionInput,
  ): Promise<ChannelConnection> {
    const connection = await channelRepository.findById(id);
    if (!connection || connection.organizationId !== organizationId) {
      throw new NotFoundError('channel_connection', id);
    }
    return channelRepository.update(id, input);
  },

  async delete(id: string, organizationId: string): Promise<void> {
    const connection = await channelRepository.findById(id);
    if (!connection || connection.organizationId !== organizationId) {
      throw new NotFoundError('channel_connection', id);
    }
    await channelRepository.delete(id);
  },

  async findByProperty(propertyId: string): Promise<ChannelConnection[]> {
    return channelRepository.findByProperty(propertyId);
  },

  async findByOrganization(organizationId: string): Promise<ChannelConnection[]> {
    return channelRepository.findByOrganization(organizationId);
  },

  async getRecentLogs(connectionId: string, organizationId: string) {
    const connection = await channelRepository.findById(connectionId);
    if (!connection || connection.organizationId !== organizationId) {
      throw new NotFoundError('channel_connection', connectionId);
    }
    return channelRepository.recentSyncLogs(connectionId);
  },
};
