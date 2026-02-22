import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AuthExceptionFilter } from './auth-exception.filter';

describe('AuthExceptionFilter', () => {
  let filter: AuthExceptionFilter;
  let mockResponse: { status: jest.Mock; redirect: jest.Mock; json: jest.Mock };
  let mockRequest: { url?: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AuthExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      json: jest.fn(),
    };
    mockRequest = {};
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should redirect on auth callback and log when request is auth callback', () => {
    mockRequest.url = '/auth/google/callback';
    const exception = new Error('OAuth failed');
    filter.catch(exception, mockHost);
    expect(mockResponse.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?error=unauthorized'),
    );
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 and message for HttpException when not auth callback', () => {
    mockRequest.url = '/api/words';
    const exception = new HttpException(
      'Unauthorized',
      HttpStatus.UNAUTHORIZED,
    );
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should return exception getResponse() when HttpException has object', () => {
    mockRequest.url = '/api/words';
    const exception = new HttpException(
      { message: 'Bad request', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Bad request' }),
    );
  });

  it('should return 500 for non-HttpException when not auth callback', () => {
    mockRequest.url = '/api/words';
    filter.catch(new Error('Boom'), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith('Internal server error');
  });

  it('should log non-Error exception in auth callback path', () => {
    mockRequest.url = '/auth/google/callback';
    filter.catch('string error', mockHost);
    expect(mockResponse.redirect).toHaveBeenCalledWith(
      expect.stringContaining('error=unauthorized'),
    );
  });
});
