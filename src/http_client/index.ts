import axios from 'axios'
import { getLogger } from '../logger'
import HttpLogInterceptorsBuilder from './http_log_interceptors'

const { logRequestInterceptor, logResponseInterceptor } = HttpLogInterceptorsBuilder(getLogger(__filename))

axios.interceptors.request.use(logRequestInterceptor)
axios.interceptors.response.use(logResponseInterceptor)

export default axios
